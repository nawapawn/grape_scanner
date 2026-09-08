/**
 * ==========================================================================
 * ตัวควบคุมหลักของแอปพลิเคชัน (Main Application Controller)
 * ธีม iOS Camera Split Layout — Full-screen camera + Bottom Sheet
 * ==========================================================================
 */

class GrapeScannerApp {
  constructor() {
    this.camera  = new CameraService();
    this.ai      = new ScannerAI();
    this.history = new HistoryService();

    // สถานะแอปพลิเคชัน
    this.currentTab     = "camera";
    this.isFrozen       = false;
    this.isLiveScanning = false;
    this.lastResult     = null;
    this.mascotTipIndex = 0;

    // แคช DOM elements เพื่อลดการ query ซ้ำ
    this.dom = this._cacheDOM();
  }

  /**
   * รวบรวม DOM references ทั้งหมดไว้ที่เดียว
   */
  _cacheDOM() {
    return {
      // Top Bar
      mascotIcon:    document.getElementById("mascot-icon"),
      statusPill:    document.getElementById("status-pill"),
      statusText:    document.getElementById("status-text"),
      torchBtn:      document.getElementById("torch-btn"),

      // Camera Layer
      video:         document.getElementById("webcam-video"),
      canvas:        document.getElementById("snapshot-canvas"),
      standby:       document.getElementById("camera-standby"),
      btnStartCamera:document.getElementById("btn-start-camera"),

      // Reticle & Overlay
      reticleOverlay:document.getElementById("reticle-overlay"),
      scannerLaser:  document.getElementById("scanner-laser"),
      modeBadge:     document.getElementById("mode-badge"),
      modeBadgeText: document.getElementById("mode-badge-text"),

      // Camera Controls
      btnShutter:    document.getElementById("btn-shutter"),
      shutterCore:   document.getElementById("shutter-core"),
      btnStreamToggle:document.getElementById("btn-stream-toggle"),
      imageUploadInput:document.getElementById("image-upload"),

      // Bottom Sheet Navigation
      navButtons: {
        camera:  document.getElementById("nav-btn-camera"),
        samples: document.getElementById("nav-btn-samples"),
        history: document.getElementById("nav-btn-history"),
      },
      historyBadge:  document.getElementById("history-badge"),

      // Panel: Camera (ผลวิเคราะห์)
      resultStatusBadge:  document.getElementById("result-status-badge"),
      leadingClassName:   document.getElementById("leading-class-name"),
      leadingClassPct:    document.getElementById("leading-class-pct"),
      confidenceBar:      document.getElementById("confidence-bar"),
      classBarsContainer: document.getElementById("class-bars-container"),
      agronomyAdviceText: document.getElementById("agronomy-advice-text"),
      recordPlotInput:    document.getElementById("record-plot-input"),
      btnSaveRecord:      document.getElementById("btn-save-record"),

      // Panel: Samples
      samplesGrid: document.getElementById("drive-samples-grid"),

      // Panel: History
      historyTableBody: document.getElementById("history-table-body"),
      btnExportCsv:     document.getElementById("btn-export-csv"),
      btnClearHistory:  document.getElementById("btn-clear-history"),

      // Bottom Sheet
      bottomSheet: document.getElementById("bottom-sheet"),
      panels: {
        camera:  document.getElementById("panel-camera"),
        samples: document.getElementById("panel-samples"),
        history: document.getElementById("panel-history"),
      },

      // Toast & Modal
      toast:          document.getElementById("toast"),
      toastMsg:       document.getElementById("toast-msg"),
      confirmModal:   document.getElementById("confirm-modal"),
      btnCancelModal: document.getElementById("btn-cancel-modal"),
      btnConfirmModal:document.getElementById("btn-confirm-modal"),
    };
  }

  /**
   * เริ่มต้นระบบทั้งหมด
   */
  async init() {
    this._renderSampleCards();
    this._bindEventListeners();
    this._setupBottomSheetSwipe();
    this._updateHistoryBadge();
    await this._loadModel();
  }

  // ============================================================
  //  โมเดล AI
  // ============================================================

  /**
   * โหลดโมเดล AI พร้อมอัปเดตสถานะบน Header
   */
  async _loadModel() {
    this._setStatus("loading", "โหลดโมเดล...");
    try {
      await this.ai.loadModel();
      this._setStatus("ready", "AI พร้อม");
    } catch (err) {
      console.error(err);
      this._setStatus("error", "โหลดไม่สำเร็จ");
      this.showToast("ไม่สามารถโหลดโมเดล AI ได้ โปรดตรวจเน็ต");
    }
  }

  /**
   * อัปเดตป้ายสถานะโมเดล (status pill บน top bar)
   */
  _setStatus(type, text) {
    const pill = this.dom.statusPill;
    pill.className   = ""; // reset
    pill.id          = "status-pill";
    pill.classList.add(type);
    this.dom.statusText.textContent = text;
  }

  // ============================================================
  //  Navigation & Tabs
  // ============================================================

  /**
   * สลับ Tab และ Panel ใน Bottom Sheet
   */
  switchTab(tabId) {
    if (this.currentTab === tabId) return;
    this.currentTab = tabId;

    // อัปเดต tab buttons
    Object.entries(this.dom.navButtons).forEach(([id, btn]) => {
      const isActive = id === tabId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    // อัปเดต panels
    Object.entries(this.dom.panels).forEach(([id, panel]) => {
      panel.classList.toggle("active", id === tabId);
    });

    // ขยาย Bottom Sheet เมื่อเปิด samples หรือ history
    const sheetHeight = (tabId === "camera")
      ? "var(--bottom-sheet-peek)"
      : "min(78vh, 600px)";
    this.dom.bottomSheet.style.height = `calc(${sheetHeight} + var(--safe-bottom))`;

    // จัดการ AI Loop
    if (tabId !== "camera") {
      this.ai.stopLoop();
    } else if (this.camera.isStreaming && !this.isFrozen && this.isLiveScanning) {
      this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
    }

    if (tabId === "history") this.renderHistoryTable();
  }

  // ============================================================
  //  Bottom Sheet Swipe Gesture
  // ============================================================

  /**
   * ตั้งค่า Swipe Up/Down บน Bottom Sheet handle
   */
  _setupBottomSheetSwipe() {
    const sheet = this.dom.bottomSheet;
    let startY = 0;
    let startH = 0;

    const onPointerDown = (e) => {
      // ตรวจว่า touch อยู่ใน handle หรือ nav
      const target = e.target.closest(".sheet-handle, #sheet-nav");
      if (!target) return;

      startY = e.touches ? e.touches[0].clientY : e.clientY;
      startH = sheet.offsetHeight;
      sheet.style.transition = "none";

      const onMove = (ev) => {
        const y   = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const dy  = startY - y;
        const min = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--bottom-sheet-peek")) || 220;
        const max = window.innerHeight * 0.82;
        const newH = Math.min(max, Math.max(min, startH + dy));
        sheet.style.height = newH + "px";
      };

      const onEnd = () => {
        sheet.style.transition = "";
        const currentH = sheet.offsetHeight;
        const midpoint = window.innerHeight * 0.42;
        // Snap ขึ้นหรือลง
        sheet.style.height = currentH > midpoint
          ? "min(78vh, 600px)"
          : "calc(var(--bottom-sheet-peek) + var(--safe-bottom))";
        document.removeEventListener("mousemove",  onMove);
        document.removeEventListener("touchmove",  onMove);
        document.removeEventListener("mouseup",    onEnd);
        document.removeEventListener("touchend",   onEnd);
      };

      document.addEventListener("mousemove",  onMove, { passive: true });
      document.addEventListener("touchmove",  onMove, { passive: true });
      document.addEventListener("mouseup",    onEnd);
      document.addEventListener("touchend",   onEnd);
    };

    sheet.addEventListener("mousedown",  onPointerDown);
    sheet.addEventListener("touchstart", onPointerDown, { passive: true });
  }

  // ============================================================
  //  กล้อง
  // ============================================================

  /**
   * เปิดกล้องหลัง
   */
  async startRearCamera() {
    if (!this.ai.isLoaded) {
      this.showToast("กำลังเตรียมโมเดล AI กรุณารอสักครู่...");
      return;
    }

    const btn = this.dom.btnStartCamera;
    btn.disabled  = true;
    btn.innerHTML = "<span>กำลังเปิดกล้อง...</span>";

    try {
      await this.camera.startCamera(this.dom.video);

      // แสดงปุ่มไฟฉายถ้ารองรับ
      if (this.camera.hasTorchCapability) {
        this.dom.torchBtn.classList.remove("hidden");
      }

      // ซ่อน standby และแสดงวิดีโอ
      this.dom.standby.style.display        = "none";
      this.dom.canvas.style.display         = "none";
      this.dom.video.style.display          = "block";
      this.dom.reticleOverlay.classList.add("visible");
      this.dom.modeBadge.classList.add("visible");
      this.dom.modeBadgeText.textContent    = "สแกนสด";

      this.dom.btnShutter.disabled          = false;
      this.dom.btnStreamToggle.disabled     = false;
      this._setStreamToggleActive(true);

      this.isLiveScanning = true;
      this.isFrozen       = false;

      this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
      this.showToast("เปิดกล้องสำเร็จ จัดกรอบให้เห็นใบองุ่น");
    } catch (err) {
      console.error("Camera error:", err);
      btn.disabled  = false;
      btn.innerHTML = `
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        ลองใหม่อีกครั้ง`;
      this.showToast(err.message || "ไม่สามารถเปิดกล้องได้");
    }
  }

  /**
   * เปิด/ปิดไฟฉาย
   */
  async toggleTorch() {
    try {
      const isOn = await this.camera.toggleTorch();
      this.dom.torchBtn.classList.toggle("torch-on", isOn);
      this.showToast(isOn ? "เปิดไฟฉายแล้ว" : "ปิดไฟฉายแล้ว");
    } catch (err) {
      this.showToast(err.message);
    }
  }

  /**
   * กดปุ่มชัตเตอร์
   */
  handleShutter() {
    this._triggerHaptic();
    if (!this.camera.isStreaming && this.dom.canvas.style.display === "none") {
      this.showToast("กรุณาเปิดกล้องก่อนถ่ายภาพ");
      return;
    }
    this.isFrozen ? this.unfreezeFrame() : this.freezeFrame();
  }

  /**
   * หยุดภาพนิ่ง (Freeze)
   */
  async freezeFrame() {
    const { video, canvas } = this.dom;
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    video.style.display  = "none";
    canvas.style.display = "block";

    this.isFrozen       = true;
    this.isLiveScanning = false;
    this.ai.stopLoop();

    this.dom.scannerLaser.style.display   = "none";
    this.dom.modeBadgeText.textContent    = "ภาพนิ่ง";
    this.dom.btnShutter.classList.add("frozen");

    // เปลี่ยนไอคอนชัตเตอร์เป็นหมุนกลับ
    this.dom.shutterCore.innerHTML = `
      <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    `;

    const results = await this.ai.predict(canvas);
    if (results) this.handleInferenceResult(results);

    this.showToast("หยุดภาพนิ่งแล้ว กดบันทึกเพื่อเก็บข้อมูล");
  }

  /**
   * ยกเลิกภาพนิ่ง กลับสู่โหมดสแกนสด
   */
  unfreezeFrame() {
    this.dom.canvas.style.display = "none";
    this.dom.video.style.display  = "block";

    this.isFrozen       = false;
    this.isLiveScanning = true;

    this.dom.scannerLaser.style.display = "";
    this.dom.modeBadgeText.textContent  = "สแกนสด";
    this.dom.btnShutter.classList.remove("frozen");

    this.dom.shutterCore.innerHTML = `
      <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="7" />
      </svg>
    `;

    this._setStreamToggleActive(true);
    this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
    this.showToast("กลับสู่โหมดสแกนสด");
  }

  /**
   * สลับโหมดสแกนต่อเนื่อง
   */
  toggleLiveStreaming() {
    if (this.isFrozen) { this.unfreezeFrame(); return; }

    this.isLiveScanning = !this.isLiveScanning;
    if (this.isLiveScanning) {
      this._setStreamToggleActive(true);
      this.dom.scannerLaser.style.display = "";
      this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
      this.showToast("เปิดสแกนสดต่อเนื่อง");
    } else {
      this._setStreamToggleActive(false);
      this.dom.scannerLaser.style.display = "none";
      this.ai.stopLoop();
      this.showToast("หยุดสแกนชั่วคราว");
    }
  }

  _setStreamToggleActive(isActive) {
    this.dom.btnStreamToggle.classList.toggle("stream-on", isActive);
  }

  // ============================================================
  //  อัปโหลดรูปภาพ
  // ============================================================

  /**
   * จัดการอัปโหลดรูปจากเครื่อง
   */
  handleFileUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas    = this.dom.canvas;
        canvas.width    = img.width;
        canvas.height   = img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);

        this.dom.standby.style.display = "none";
        this.dom.video.style.display   = "none";
        canvas.style.display           = "block";
        this.dom.reticleOverlay.classList.add("visible");
        this.dom.scannerLaser.style.display = "none";

        this.isFrozen       = true;
        this.isLiveScanning = false;
        this.ai.stopLoop();

        this.dom.btnShutter.disabled          = false;
        this.dom.btnStreamToggle.disabled     = false;
        this.dom.btnShutter.classList.add("frozen");
        this.dom.modeBadgeText.textContent    = "รูปจากเครื่อง";
        this.dom.modeBadge.classList.add("visible");

        const results = await this.ai.predict(canvas);
        if (results) this.handleInferenceResult(results);
        this.showToast("โหลดรูปและวิเคราะห์เรียบร้อย");
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  // ============================================================
  //  ทดสอบภาพตัวอย่าง
  // ============================================================

  /**
   * ทดสอบภาพจากแท็บตัวอย่าง 7 โรค
   */
  async testSampleWithAi(diseaseId) {
    const disease = DISEASE_DATABASE[diseaseId];
    if (!disease) return;

    this._triggerHaptic();
    const img    = document.getElementById(`sample-img-${diseaseId}`);
    const canvas = this.dom.canvas;

    canvas.width  = img?.naturalWidth  || 640;
    canvas.height = img?.naturalHeight || 480;
    const ctx = canvas.getContext("2d");

    try {
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } else {
        this._drawSyntheticLeaf(ctx, canvas.width, canvas.height);
      }
    } catch {
      this._drawSyntheticLeaf(ctx, canvas.width, canvas.height);
    }

    this.switchTab("camera");

    this.dom.standby.style.display = "none";
    this.dom.video.style.display   = "none";
    canvas.style.display           = "block";
    this.dom.reticleOverlay.classList.add("visible");
    this.dom.scannerLaser.style.display = "none";

    this.isFrozen       = true;
    this.isLiveScanning = false;
    this.ai.stopLoop();

    this.dom.btnShutter.disabled          = false;
    this.dom.btnStreamToggle.disabled     = false;
    this.dom.btnShutter.classList.add("frozen");
    this.dom.modeBadgeText.textContent    = disease.nameTh;
    this.dom.modeBadge.classList.add("visible");

    const results = await this.ai.predict(canvas);
    if (results) this.handleInferenceResult(results);
    this.showToast(`ทดสอบภาพ: ${disease.nameTh}`);
  }

  /**
   * ภาพใบองุ่นสังเคราะห์กรณีติด CORS
   */
  _drawSyntheticLeaf(ctx, w, h) {
    ctx.fillStyle = "#1a2e1a";
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2, h / 2 + 10);
    ctx.beginPath();
    ctx.moveTo(0, 80);
    ctx.bezierCurveTo(-40, 70, -100, 50, -110, 10);
    ctx.bezierCurveTo(-140, 5, -150, -45, -95, -70);
    ctx.bezierCurveTo(-75, -85, -55, -75, -35, -105);
    ctx.bezierCurveTo(-20, -125, 0, -120, 0, -115);
    ctx.bezierCurveTo(0, -120, 20, -125, 35, -105);
    ctx.bezierCurveTo(55, -75, 75, -85, 95, -70);
    ctx.bezierCurveTo(150, -45, 140, 5, 110, 10);
    ctx.bezierCurveTo(100, 50, 40, 70, 0, 80);
    ctx.closePath();
    ctx.fillStyle = "#2d6a4f";
    ctx.fill();
    ctx.restore();
  }

  // ============================================================
  //  ผลวิเคราะห์ AI
  // ============================================================

  /**
   * อัปเดตผล inference ลงหน้าจอ
   */
  handleInferenceResult(results) {
    if (!results || !results.topPrediction) return;

    const { topPrediction, predictions } = results;
    const disease  = topPrediction.diseaseInfo;
    this.lastResult = topPrediction;

    const pct = topPrediction.percentage;
    const prob = topPrediction.probability;

    // 1. ผลลัพธ์หลัก
    this.dom.leadingClassName.textContent = disease.nameTh || topPrediction.className;
    this.dom.leadingClassPct.textContent  = `${pct}%`;
    this.dom.confidenceBar.style.width    = `${pct}%`;
    this.dom.btnSaveRecord.disabled       = false;

    // 2. Status badge
    const badge = this.dom.resultStatusBadge;
    badge.className = "result-status-badge";
    if (prob >= 0.70) {
      badge.classList.add(disease.isHealthy ? "healthy" : "disease");
      badge.textContent = disease.isHealthy ? "✓ ใบปกติ" : "⚠ พบโรค";
    } else if (prob >= 0.40) {
      badge.classList.add("low-conf");
      badge.textContent = "ความมั่นใจต่ำ";
    } else {
      badge.classList.add("scanning");
      badge.textContent = "🔍 กำลังวิเคราะห์...";
    }

    // 3. แถบเปอร์เซ็นต์ทุกคลาส
    this.dom.classBarsContainer.innerHTML = predictions.map((pred) => {
      const isLead = pred.isLeading;
      const name   = pred.diseaseInfo?.nameTh || pred.className;
      return `
        <div class="bar-item">
          <div class="bar-label">
            <span class="bar-label-name ${isLead ? "leading" : ""}">
              ${isLead ? '<span class="bar-label-dot"></span>' : ""}
              ${name}
            </span>
            <span class="bar-label-pct">${pred.percentage}%</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill ${isLead ? "leading-bar" : ""}"
                 style="width:${pred.percentage}%"></div>
          </div>
        </div>
      `;
    }).join("");

    // 4. คำแนะนำเชิงเกษตร
    if (prob < 0.45) {
      this.dom.agronomyAdviceText.innerHTML = `
        <strong>ความมั่นใจต่ำ (&lt;45%):</strong>
        ขยับกล้องเข้าใกล้ใบองุ่นมากขึ้น ปรับโฟกัสให้ชัด และจัดแสงไม่ให้เกิดเงามืด
      `;
    } else {
      this.dom.agronomyAdviceText.innerHTML = `
        <strong>${disease.guidance.title}</strong>
        ${disease.guidance.desc}
      `;
    }
  }

  // ============================================================
  //  บันทึก / ประวัติ
  // ============================================================

  saveCurrentRecord() {
    if (!this.lastResult) { this.showToast("ยังไม่มีผลตรวจเพื่อบันทึก"); return; }
    this._triggerHaptic();
    const plot = this.dom.recordPlotInput.value.trim() || "แปลงทั่วไป";
    this.history.addRecord({
      className:    this.lastResult.className,
      probability:  this.lastResult.probability,
      confidencePct:this.lastResult.percentage,
      plot,
      diseaseInfo:  this.lastResult.diseaseInfo,
    });
    this.dom.recordPlotInput.value = "";
    this._updateHistoryBadge();
    this.showToast("บันทึกข้อมูลสำเร็จ");
  }

  renderHistoryTable() {
    const records = this.history.getRecords();
    this._updateHistoryBadge();

    if (records.length === 0) {
      this.dom.historyTableBody.innerHTML = `
        <tr><td colspan="4" class="empty-state">ยังไม่มีบันทึก กด "บันทึก" หลังสแกน</td></tr>
      `;
      return;
    }

    this.dom.historyTableBody.innerHTML = records.map((rec) => {
      const pillClass  = rec.isHealthy ? "healthy" : "disease";
      const displayName = rec.nameTh || rec.className;
      return `
        <tr>
          <td>
            <div class="td-plot">${rec.plot}</div>
            <div class="td-time">${rec.timestamp}</div>
          </td>
          <td>
            <span class="result-pill ${pillClass}">${displayName}</span>
          </td>
          <td class="td-pct">${rec.confidencePct}%</td>
          <td style="text-align:center">
            <button class="btn-delete-record"
                    data-action="delete-record"
                    data-id="${rec.id}"
                    title="ลบรายการ"
                    aria-label="ลบรายการ">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  deleteHistoryRecord(id) {
    this._triggerHaptic();
    this.history.deleteRecord(id);
    this.renderHistoryTable();
    this.showToast("ลบรายการแล้ว");
  }

  exportHistoryCSV() {
    const ok = this.history.exportCSV();
    this.showToast(ok ? "ดาวน์โหลด CSV แล้ว" : "ไม่มีข้อมูลสำหรับส่งออก");
  }

  showClearModal() {
    if (this.history.getRecords().length === 0) { this.showToast("ไม่มีข้อมูลในประวัติ"); return; }
    this.dom.confirmModal.classList.add("open");
  }

  closeClearModal()   { this.dom.confirmModal.classList.remove("open"); }

  confirmClearHistory() {
    this.history.clearAll();
    this.closeClearModal();
    this.renderHistoryTable();
    this.showToast("ล้างประวัติเรียบร้อย");
  }

  _updateHistoryBadge() {
    const count = this.history.getRecords().length;
    const badge = this.dom.historyBadge;
    badge.textContent = count;
    badge.dataset.count = count;
  }

  // ============================================================
  //  Sample Cards
  // ============================================================

  /**
   * เรนเดอร์การ์ดตัวอย่าง 7 โรคแบบ Dynamic
   */
  _renderSampleCards() {
    if (!this.dom.samplesGrid) return;

    this.dom.samplesGrid.innerHTML = DISEASE_LIST.map((disease, idx) => {
      const isLast  = idx === DISEASE_LIST.length - 1;
      const isOdd   = DISEASE_LIST.length % 2 !== 0;
      const spanFull = isLast && isOdd ? "full-width" : "";

      return `
        <article class="disease-card ${spanFull}">
          <div class="disease-card-img-wrap">
            <img id="sample-img-${disease.id}"
                 src="https://lh3.googleusercontent.com/d/${disease.driveFileId}"
                 alt="${disease.nameEn} leaf"
                 crossorigin="anonymous"
                 onerror="window.__grapeApp.handleImageFallback(this, '${disease.driveFileId}', '${disease.id}')" />
            <span class="disease-tag ${disease.tagStyle}">${disease.nameEn}</span>
          </div>
          <div class="disease-card-body">
            <div class="disease-name">${disease.nameTh}</div>
            <span class="disease-badge ${disease.badgeStyle}">${disease.tagText}</span>
            <p class="disease-symptoms">${disease.symptoms}</p>
            <button class="btn-test-sample"
                    data-action="test-sample"
                    data-disease-id="${disease.id}">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              ทดสอบภาพนี้กับ AI
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  /**
   * Fallback รูปภาพจาก Google Drive (กรณี URL ตรงถูกบล็อก)
   */
  handleImageFallback(imgEl, fileId, diseaseId) {
    if (!imgEl.dataset.retried) {
      imgEl.dataset.retried = "true";
      imgEl.src = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    }
  }

  // ============================================================
  //  Mascot Tips
  // ============================================================

  cycleMascotTip() {
    this._triggerHaptic();
    this.mascotTipIndex = (this.mascotTipIndex + 1) % MASCOT_TIPS.length;
    this.showToast(MASCOT_TIPS[this.mascotTipIndex]);
  }

  // ============================================================
  //  Toast & Haptic
  // ============================================================

  showToast(message, duration = 2800) {
    this.dom.toastMsg.textContent = message;
    this.dom.toast.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.dom.toast.classList.remove("show");
    }, duration);
  }

  _triggerHaptic() {
    try { navigator.vibrate?.(40); } catch { /* ไม่รองรับ */ }
  }

  // ============================================================
  //  Event Listeners
  // ============================================================

  _bindEventListeners() {
    // Top bar
    this.dom.mascotIcon?.addEventListener("click", () => this.cycleMascotTip());
    this.dom.torchBtn?.addEventListener("click", () => this.toggleTorch());

    // Navigation tabs
    this.dom.navButtons.camera?.addEventListener("click",  () => this.switchTab("camera"));
    this.dom.navButtons.samples?.addEventListener("click", () => this.switchTab("samples"));
    this.dom.navButtons.history?.addEventListener("click", () => this.switchTab("history"));

    // Camera controls
    this.dom.btnStartCamera?.addEventListener("click",  () => this.startRearCamera());
    this.dom.btnShutter?.addEventListener("click",      () => this.handleShutter());
    this.dom.btnStreamToggle?.addEventListener("click", () => this.toggleLiveStreaming());
    this.dom.imageUploadInput?.addEventListener("change", (e) => this.handleFileUpload(e));

    // Save record
    this.dom.btnSaveRecord?.addEventListener("click", () => this.saveCurrentRecord());

    // History panel
    this.dom.btnExportCsv?.addEventListener("click",    () => this.exportHistoryCSV());
    this.dom.btnClearHistory?.addEventListener("click", () => this.showClearModal());
    this.dom.btnCancelModal?.addEventListener("click",  () => this.closeClearModal());
    this.dom.btnConfirmModal?.addEventListener("click", () => this.confirmClearHistory());

    // Event delegation: ปุ่มทดสอบใน samples grid
    this.dom.samplesGrid?.addEventListener("click", (e) => {
      const btn = e.target.closest('button[data-action="test-sample"]');
      if (btn) this.testSampleWithAi(btn.dataset.diseaseId);
    });

    // Event delegation: ปุ่มลบในตารางประวัติ
    this.dom.historyTableBody?.addEventListener("click", (e) => {
      const btn = e.target.closest('button[data-action="delete-record"]');
      if (btn) this.deleteHistoryRecord(btn.dataset.id);
    });

    // ปิดสแกนเมื่อผู้ใช้สลับไปแอปอื่น เพื่อประหยัดแบตเตอรี่
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && this.camera.isStreaming) {
        this.ai.stopLoop();
      } else if (!document.hidden && this.camera.isStreaming &&
                 this.currentTab === "camera" && !this.isFrozen) {
        this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
      }
    });
  }
}

// เริ่มทำงานเมื่อ DOM พร้อม
window.addEventListener("DOMContentLoaded", () => {
  window.__grapeApp = new GrapeScannerApp();
  window.__grapeApp.init();
});
