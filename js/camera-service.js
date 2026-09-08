/**
 * ==========================================================================
 * ตัวจัดการกล้องหลังและระบบไฟฉาย (Camera & Hardware Controller)
 * ==========================================================================
 */

class CameraService {
  constructor() {
    this.stream = null;
    this.activeTrack = null;
    this.videoElement = null;
    this.isTorchOn = false;
    this.hasTorchCapability = false;
    this.isStreaming = false;
  }

  /**
   * เริ่มต้นใช้งานกล้องหลัง (Environment Camera) พร้อมกลไกสำรองกรณีอุปกรณ์ไม่รองรับ exact
   * @param {HTMLVideoElement} videoElement แท็ก video สำหรับแสดงผล
   */
  async startCamera(videoElement) {
    this.videoElement = videoElement;
    this.stopCamera(); // ปิดสตรีมเดิมก่อนเปิดใหม่เพื่อป้องกันการค้าง

    let stream = null;

    // 1. พยายามเรียกกล้องหลังแบบเจาะจง (Exact Environment)
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { exact: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });
    } catch (exactErr) {
      console.warn("Exact environment camera failed, falling back to ideal:", exactErr);

      // 2. หากไม่สำเร็จ ให้เรียกแบบยืดหยุ่น (Ideal Environment)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (fallbackErr) {
        console.error("Camera access failed completely:", fallbackErr);
        throw new Error(this._formatCameraError(fallbackErr));
      }
    }

    this.stream = stream;
    this.videoElement.srcObject = stream;

    // รอให้โหลด Metadata ของวิดีโอเสร็จแล้วจึงเริ่มเล่น
    await new Promise((resolve) => {
      this.videoElement.onloadedmetadata = () => {
        this.videoElement.play().catch((e) => console.warn("Video play interrupted:", e));
        resolve();
      };
    });

    // ตรวจสอบความสามารถในการเปิดไฟฉายบนมือถือ
    const tracks = stream.getVideoTracks();
    if (tracks.length > 0) {
      this.activeTrack = tracks[0];
      const capabilities = this.activeTrack.getCapabilities ? this.activeTrack.getCapabilities() : {};
      this.hasTorchCapability = Boolean(capabilities.torch);
    }

    this.isStreaming = true;
    this.isTorchOn = false;
    return stream;
  }

  /**
   * หยุดการทำงานของกล้องและคืนทรัพยากรฮาร์ดแวร์
   */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn("Error stopping track:", e);
        }
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }

    this.activeTrack = null;
    this.isStreaming = false;
    this.isTorchOn = false;
  }

  /**
   * สลับเปิด/ปิดไฟฉายของกล้องหลัง
   * @returns {Promise<boolean>} สถานะไฟฉายปัจจุบัน
   */
  async toggleTorch() {
    if (!this.activeTrack || !this.hasTorchCapability) {
      throw new Error("อุปกรณ์นี้ไม่รองรับการเปิดไฟฉายผ่านเบราว์เซอร์");
    }

    try {
      this.isTorchOn = !this.isTorchOn;
      await this.activeTrack.applyConstraints({
        advanced: [{ torch: this.isTorchOn }]
      });
      return this.isTorchOn;
    } catch (err) {
      console.error("Failed to toggle torch:", err);
      this.isTorchOn = !this.isTorchOn;
      throw new Error("ไม่สามารถสลับสถานะไฟฉายได้");
    }
  }

  /**
   * แปลงข้อความข้อผิดพลาดเกี่ยวกับกล้องให้ผู้ใช้เข้าใจง่าย
   * @private
   */
  _formatCameraError(error) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "กรุณาอนุญาตให้เบราว์เซอร์เข้าถึงกล้องถ่ายภาพในการตั้งค่า";
    }
    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "ไม่พบกล้องถ่ายภาพบนอุปกรณ์นี้";
    }
    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "กล้องกำลังถูกใช้งานโดยแอปอื่น กรุณาปิดแอปอื่นแล้วลองใหม่";
    }
    return "ไม่สามารถเชื่อมต่อกล้องได้ โปรดตรวจการตั้งค่าและใช้งานผ่าน HTTPS";
  }
}
