/**
 * ==========================================================================
 * ตัวประมวลผล AI และการวิเคราะห์ภาพ (Teachable Machine AI Engine)
 * ==========================================================================
 */

class ScannerAI {
  constructor(modelBaseUrl = "https://teachablemachine.withgoogle.com/models/BK5h9OhwU/") {
    this.modelBaseUrl = modelBaseUrl;
    this.model = null;
    this.totalClasses = 0;
    this.isLoaded = false;
    this.isLoading = false;

    // การควบคุมการวนลูปวิเคราะห์แบบจำกัดความถี่ (Throttling) เพื่อประหยัดแบตเตอรี่และความลื่นไหล
    this.isInferencing = false;
    this.animationFrameId = null;
    this.loopRunning = false;
    this.minInferenceIntervalMs = 250; // ประมาณ 4 ครั้งต่อวินาที ป้องกันเครื่องร้อน
    this.lastInferenceTime = 0;
  }

  /**
   * ดาวน์โหลดและโหลดโมเดล Teachable Machine
   */
  async loadModel() {
    if (this.isLoaded) return true;
    this.isLoading = true;

    try {
      const modelURL = this.modelBaseUrl + "model.json";
      const metadataURL = this.modelBaseUrl + "metadata.json";

      this.model = await tmImage.load(modelURL, metadataURL);
      this.totalClasses = this.model.getTotalClasses();
      this.isLoaded = true;
      this.isLoading = false;
      return true;
    } catch (err) {
      this.isLoading = false;
      this.isLoaded = false;
      console.error("Failed to load AI model:", err);
      throw new Error("ไม่สามารถโหลดโมเดล AI ได้ โปรดตรวจการเชื่อมต่ออินเทอร์เน็ต");
    }
  }

  /**
   * ส่งภาพหรือเฟรมวิดีโอเข้าวิเคราะห์ผล
   * @param {HTMLVideoElement|HTMLImageElement|HTMLCanvasElement} source แหล่งข้อมูลภาพ
   * @returns {Promise<{topPrediction: object, predictions: Array}>}
   */
  async predict(source) {
    if (!this.isLoaded || !this.model) {
      throw new Error("โมเดล AI ยังไม่พร้อมใช้งาน");
    }

    const rawPredictions = await this.model.predict(source);
    if (!rawPredictions || rawPredictions.length === 0) {
      return null;
    }

    // ค้นหาคลาสที่มีค่าความน่าจะเป็นสูงสุด
    let top = rawPredictions[0];
    for (let i = 1; i < rawPredictions.length; i++) {
      if (rawPredictions[i].probability > top.probability) {
        top = rawPredictions[i];
      }
    }

    const topPct = (top.probability * 100).toFixed(1);
    const topDiseaseInfo = resolveDiseaseInfo(top.className);

    // ปรับโครงสร้างข้อมูลผลลัพธ์ทุกคลาส
    const formatted = rawPredictions.map((item) => {
      const pct = (item.probability * 100).toFixed(1);
      const isLeading = item.className === top.className;
      const diseaseInfo = resolveDiseaseInfo(item.className);

      return {
        className: item.className,
        probability: item.probability,
        percentage: pct,
        isLeading,
        diseaseInfo
      };
    });

    // เรียงลำดับจากค่าความมั่นใจมากไปน้อย
    formatted.sort((a, b) => b.probability - a.probability);

    return {
      topPrediction: {
        className: top.className,
        probability: top.probability,
        percentage: topPct,
        diseaseInfo: topDiseaseInfo,
        timestamp: new Date().toISOString()
      },
      predictions: formatted
    };
  }

  /**
   * เริ่มวนลูปวิเคราะห์สดจากวิดีโอแบบควบคุมความถี่
   * @param {HTMLVideoElement} videoElement
   * @param {Function} onResultCallback ฟังก์ชันรับผลลัพธ์
   */
  startLoop(videoElement, onResultCallback) {
    this.loopRunning = true;

    const step = async (timestamp) => {
      if (!this.loopRunning) return;

      const elapsed = timestamp - this.lastInferenceTime;
      const hasEnoughData = videoElement.readyState >= videoElement.HAVE_ENOUGH_DATA;

      if (elapsed >= this.minInferenceIntervalMs && hasEnoughData && !this.isInferencing) {
        this.isInferencing = true;
        this.lastInferenceTime = timestamp;

        try {
          const results = await this.predict(videoElement);
          if (results && this.loopRunning && typeof onResultCallback === "function") {
            onResultCallback(results);
          }
        } catch (err) {
          console.warn("Inference frame error:", err);
        } finally {
          this.isInferencing = false;
        }
      }

      if (this.loopRunning) {
        this.animationFrameId = requestAnimationFrame(step);
      }
    };

    this.animationFrameId = requestAnimationFrame(step);
  }

  /**
   * หยุดการวนลูปวิเคราะห์
   */
  stopLoop() {
    this.loopRunning = false;
    this.isInferencing = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}
