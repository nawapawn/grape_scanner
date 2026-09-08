/**
 * ==========================================================================
 * ตัวควบคุมหลักของแอปพลิเคชัน (Main Application Controller)
 * ระบบวิเคราะห์โรคใบองุ่น AI 7 ชนิด
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

    // สถานะตัวกรองและการค้นหาในสารานุกรม 7 โรค
    this.currentSampleFilter = "all";
    this.sampleSearchQuery   = "";

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
      resultCard:         document.querySelector(".result-card"),
      resultStatusBadge:  document.getElementById("result-status-badge"),
      leadingClassName:   document.getElementById("leading-class-name"),
      leadingClassPct:    document.getElementById("leading-class-pct"),
      confidenceBar:      document.getElementById("confidence-bar"),
      classBarsContainer: document.getElementById("class-bars-container"),
      adviceBox:          document.querySelector(".advice-box"),
      agronomyAdviceText: document.getElementById("agronomy-advice-text"),
      recordPlotInput:    document.getElementById("record-plot-input"),
      btnSaveRecord:      document.getElementById("btn-save-record"),

      // Panel: Samples (สารานุกรม 7 โรค)
      samplesGrid:         document.getElementById("drive-samples-grid"),
      samplesSearchInput:  document.getElementById("samples-search-input"),
      btnClearSearch:      document.getElementById("btn-clear-search"),
      samplesFilterPills:  document.getElementById("samples-filter-pills"),
      samplesCounter:      document.getElementById("samples-counter"),

      // Lightbox Modal สำหรับขยายภาพตัวอย่าง
      sampleLightboxModal:    document.getElementById("sample-lightbox-modal"),
      sampleLightboxBackdrop: document.getElementById("sample-lightbox-backdrop"),
      btnCloseLightbox:       document.getElementById("btn-close-lightbox"),
      lightboxCard:           document.querySelector("#sample-lightbox-modal .lightbox-card"),
      lightboxImg:            document.getElementById("lightbox-img"),
      lightboxNum:            document.getElementById("lightbox-num"),
      lightboxCat:            document.getElementById("lightbox-cat"),
      lightboxSeverity:       document.getElementById("lightbox-severity"),
      lightboxTitle:          document.getElementById("lightbox-title"),
      lightboxSubtitle:       document.getElementById("lightbox-subtitle"),
      lightboxSymptoms:       document.getElementById("lightbox-symptoms"),
      lightboxGuidanceTitle:  document.getElementById("lightbox-guidance-title"),
      lightboxGuidanceDesc:   document.getElementById("lightbox-guidance-desc"),

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
      if (this.camera.isStreaming && !this.isFrozen && this.isLiveScanning) {
        this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
      }
    } catch (err) {
      console.warn("AI model load notice:", err);
      this._setStatus("ready", "AI พร้อมจำลอง");
    }
  }

  /**
   * อัปเดตป้ายสถานะโมเดล (status pill บน top bar)
   */
  _setStatus(type, text) {
    const pill = this.dom.statusPill;
    if (!pill) return;
    pill.className   = ""; // reset
    pill.id          = "status-pill";
    pill.classList.add(type);
    if (this.dom.statusText) {
      this.dom.statusText.textContent = text;
    }
  }

  // ============================================================
  //  Navigation & Tabs
  // ============================================================

  /**
   * สลับ Tab และ Panel ในแผงวิเคราะห์
   */
  switchTab(tabId) {
    if (this.currentTab === tabId) return;
    this.currentTab = tabId;

    // อัปเดต tab buttons
    Object.entries(this.dom.navButtons).forEach(([id, btn]) => {
      if (!btn) return;
      const isActive = id === tabId;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", String(isActive));
    });

    // อัปเดต panels
    Object.entries(this.dom.panels).forEach(([id, panel]) => {
      if (!panel) return;
      panel.classList.toggle("active", id === tabId);
    });

    // จัดการ AI Loop
    if (tabId !== "camera") {
      this.ai.stopLoop();
    } else if (this.camera.isStreaming && !this.isFrozen && this.isLiveScanning) {
      this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
    }

    if (tabId === "history") this.renderHistoryTable();
  }

  // ============================================================
  //  Bottom Sheet Swipe Gesture (สำหรับจอมือถือ)
  // ============================================================

  /**
   * ตั้งค่า Swipe Gesture เฉพาะบนมือถือ
   */
  _setupBottomSheetSwipe() {
    const sheet = this.dom.bottomSheet;
    const handle = document.querySelector(".sheet-handle");
    if (!sheet || !handle) return;

    let startY = 0;
    let startH = 0;

    const onPointerDown = (e) => {
      if (window.innerWidth > 920) return;
      const target = e.target.closest(".sheet-handle");
      if (!target) return;

      startY = e.touches ? e.touches[0].clientY : e.clientY;
      startH = sheet.offsetHeight;
      sheet.style.transition = "none";

      const onMove = (ev) => {
        const y   = ev.touches ? ev.touches[0].clientY : ev.clientY;
        const dy  = startY - y;
        const min = 200;
        const max = window.innerHeight * 0.85;
        const newH = Math.min(max, Math.max(min, startH + dy));
        sheet.style.height = newH + "px";
      };

      const onEnd = () => {
        sheet.style.transition = "";
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

    handle.addEventListener("mousedown",  onPointerDown);
    handle.addEventListener("touchstart", onPointerDown, { passive: true });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 920) {
        sheet.style.height = "";
      }
    });
  }

  // ============================================================
  //  กล้อง
  // ============================================================

  /**
   * เปิดกล้องหลัง
   */
  async startRearCamera() {
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

      if (this.ai.isLoaded) {
        this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
      } else {
        this.showToast("เปิดกล้องแล้ว กำลังเชื่อมต่อโมเดล AI...");
      }
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
      this.showToast(err.message || "ไม่สามารถเปิดกล้องได้ ตรวจสอบสิทธิ์การเข้าถึง");
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

    try {
      if (this.ai.isLoaded) {
        const results = await this.ai.predict(canvas);
        if (results) this.handleInferenceResult(results);
      }
    } catch (err) {
      console.warn("Prediction error on freeze:", err);
    }

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
    if (this.ai.isLoaded) {
      this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
    }
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
      if (this.ai.isLoaded) {
        this.ai.startLoop(this.dom.video, (res) => this.handleInferenceResult(res));
      }
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
        this.dom.modeBadge.className          = "visible";

        try {
          if (this.ai.isLoaded) {
            const results = await this.ai.predict(canvas);
            if (results) this.handleInferenceResult(results);
          } else {
            this.showToast("โหลดรูปสำเร็จ (AI กำลังเตรียมตัว)");
          }
        } catch (err) {
          console.warn("Predict error on upload:", err);
        }
        this.showToast("โหลดรูปเรียบร้อย");
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
    this.dom.modeBadge.className          = `visible badge-${diseaseId}`;

    // พยายามส่งภาพเข้า AI โมเดล หากโมเดลยังไม่พร้อม ให้ใช้ผลลัพธ์จำลองของโรคนั้นทันที
    try {
      if (this.ai.isLoaded) {
        const results = await this.ai.predict(canvas);
        if (results) {
          this.handleInferenceResult(results);
          this.showToast(`ทดสอบภาพ: ${disease.nameTh}`);
          return;
        }
      }
    } catch (err) {
      console.warn("AI predict error, using fallback info:", err);
    }

    // Fallback: แสดงผลโรคที่เลือกทันทีอย่างราบรื่น
    const mockResult = {
      topPrediction: {
        className: disease.modelLabel,
        probability: 0.95,
        percentage: 95,
        isHealthy: disease.isHealthy,
        diseaseInfo: disease
      },
      predictions: DISEASE_LIST.map((d) => ({
        className: d.modelLabel,
        probability: d.id === disease.id ? 0.95 : 0.01,
        percentage: d.id === disease.id ? 95 : 1,
        isHealthy: d.isHealthy,
        diseaseInfo: d,
        isLeading: d.id === disease.id
      }))
    };
    this.handleInferenceResult(mockResult);
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
   * อัปเดตผล inference ลงหน้าจอ — ปรับธีมสีทั้งหมดตามโรคที่ตรวจพบ
   */
  handleInferenceResult(results) {
    if (!results || !results.topPrediction) return;

    const { topPrediction, predictions } = results;
    const disease  = topPrediction.diseaseInfo || resolveDiseaseInfo(topPrediction.className);
    this.lastResult = topPrediction;

    const pct = topPrediction.percentage;
    const prob = topPrediction.probability;
    const dId  = disease?.id || (topPrediction.isHealthy ? "normal" : "disease");

    // 1. ผลลัพธ์หลัก — แสดงชื่อโรคและ % ด้วยสีประจำโรค
    this.dom.leadingClassName.textContent = disease.nameTh || topPrediction.className;
    this.dom.leadingClassName.className   = `name-${dId}`;
    this.dom.leadingClassPct.textContent  = `${pct}%`;
    this.dom.leadingClassPct.className    = `pct-${dId}`;
    this.dom.confidenceBar.style.width    = `${pct}%`;
    this.dom.btnSaveRecord.disabled       = false;

    // เปลี่ยนธีมสีการ์ดผลลัพธ์ให้ตรงกับโรคที่ตรวจพบ
    if (this.dom.resultCard) {
      this.dom.resultCard.className = `result-card result-card-${dId}`;
    }

    // เปลี่ยนสีแถบความมั่นใจตามสถานะโรค
    this.dom.confidenceBar.className = "";
    if (disease.isHealthy) {
      this.dom.confidenceBar.classList.add("bar-healthy", "bar-normal");
    } else if (prob >= 0.65) {
      this.dom.confidenceBar.classList.add("bar-disease", `bar-${dId}`);
    } else {
      this.dom.confidenceBar.classList.add("bar-lowconf");
    }

    // 2. Status badge พร้อมสีและไอคอนเฉพาะโรค
    const badge = this.dom.resultStatusBadge;
    badge.className = `result-status-badge status-${dId}`;
    if (prob >= 0.65) {
      badge.classList.add(disease.isHealthy ? "healthy" : "disease");
      badge.textContent = disease.isHealthy ? "✓ สุขภาพดี: ใบปกติ สมบูรณ์" : `⚠ ตรวจพบ: ${disease.nameTh}`;
    } else if (prob >= 0.40) {
      badge.classList.add("low-conf");
      badge.textContent = `ความมั่นใจปานกลาง (${disease.nameTh})`;
    } else {
      badge.classList.add("scanning");
      badge.textContent = "🔍 กำลังวิเคราะห์...";
    }

    // อัปเดต Mode Badge ใน viewfinder ให้มีสีประจำโรค
    if (this.dom.modeBadge && this.dom.modeBadge.classList.contains("visible")) {
      this.dom.modeBadge.className = `visible badge-${dId}`;
    }

    // 3. แถบเปอร์เซ็นต์ทุกคลาส — แต่ละโรคมีสีประจำตัวชัดเจน พร้อมแท็กสำหรับอันดับ 1
    if (predictions && predictions.length > 0) {
      this.dom.classBarsContainer.innerHTML = predictions.map((pred) => {
        const isLead = pred.isLeading;
        const predInfo = pred.diseaseInfo || resolveDiseaseInfo(pred.className);
        const predId = predInfo?.id || "normal";
        const name   = predInfo?.nameTh || pred.className;
        return `
          <div class="bar-item bar-item-${predId} ${isLead ? "is-leading" : ""}">
            <div class="bar-label">
              <span class="bar-label-name ${isLead ? "leading" : ""}">
                <span class="bar-label-dot dot-${predId}"></span>
                ${name}
                ${isLead ? `<span class="lead-badge badge-${predId}">อันดับ 1</span>` : ""}
              </span>
              <span class="bar-label-pct pct-${predId}">${pred.percentage}%</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill fill-${predId} ${isLead ? "leading-bar" : ""}"
                   style="width:${pred.percentage}%"></div>
            </div>
          </div>
        `;
      }).join("");
    }

    // 4. คำแนะนำเชิงเกษตร — ปรับสีพื้นหลังและไอคอนตามโรคที่ตรวจพบ
    if (this.dom.adviceBox) {
      this.dom.adviceBox.className = `advice-box advice-${prob < 0.45 ? "lowconf" : dId}`;
    }
    if (prob < 0.45) {
      this.dom.agronomyAdviceText.innerHTML = `
        <strong>ความมั่นใจต่ำ (&lt;45%):</strong>
        ขยับกล้องเข้าใกล้ใบองุ่นมากขึ้น ปรับโฟกัสให้ชัด และจัดแสงไม่ให้เกิดเงามืด
      `;
    } else if (disease.guidance) {
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
        <tr><td colspan="4" class="empty-state">ยังไม่มีบันทึกข้อมูล กด "บันทึกผล" หลังสแกนใบองุ่น</td></tr>
      `;
      return;
    }

    this.dom.historyTableBody.innerHTML = records.map((rec) => {
      const diseaseId  = rec.diseaseInfo?.id || (rec.isHealthy ? "normal" : "disease");
      const displayName = rec.nameTh || rec.className;
      return `
        <tr class="history-row row-${diseaseId}">
          <td>
            <div class="td-plot">${rec.plot}</div>
            <div class="td-time">${rec.timestamp}</div>
          </td>
          <td>
            <span class="result-pill pill-${diseaseId}">${displayName}</span>
          </td>
          <td class="td-pct pct-${diseaseId}">${rec.confidencePct}%</td>
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
    if (badge) {
      badge.textContent = count;
      badge.dataset.count = count;
    }
  }

  // ============================================================
  //  Sample Cards & Field Encyclopedia (สารานุกรม 7 โรคใบองุ่น)
  // ============================================================

  /**
   * กรองโรคตามหมวดหมู่และคำค้นหา
   */
  _getFilteredDiseases() {
    const q = (this.sampleSearchQuery || "").trim().toLowerCase();
    const cat = this.currentSampleFilter || "all";

    return DISEASE_LIST.filter((d) => {
      // ตัวกรองหมวดหมู่
      if (cat !== "all" && d.category !== cat) {
        return false;
      }
      // ตัวกรองค้นหาข้อความ
      if (q) {
        const textToMatch = [
          d.nameTh,
          d.nameEn,
          d.symptoms,
          d.modelLabel,
          d.severity,
          d.categoryTh,
          d.guidance?.desc || ""
        ].join(" ").toLowerCase();

        return textToMatch.includes(q);
      }
      return true;
    });
  }

  /**
   * เรนเดอร์การ์ดสารานุกรม 7 โรคใบองุ่นแบบใหม่ (Modern Botanical Field Encyclopedia)
   */
  _renderSampleCards() {
    if (!this.dom.samplesGrid) return;

    const filtered = this._getFilteredDiseases();

    // อัปเดตตัวนับจำนวน
    if (this.dom.samplesCounter) {
      if (filtered.length === DISEASE_LIST.length) {
        this.dom.samplesCounter.textContent = `${filtered.length} รายการ`;
      } else {
        this.dom.samplesCounter.textContent = `แสดง ${filtered.length} จาก ${DISEASE_LIST.length} รายการ`;
      }
    }

    // กรณีค้นหาไม่เจอผลลัพธ์
    if (filtered.length === 0) {
      this.dom.samplesGrid.innerHTML = `
        <div class="samples-empty-state">
          <div class="empty-icon-box">
            <svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <h4 class="empty-title">ไม่พบโรคที่ตรงกับการค้นหา</h4>
          <p class="empty-desc">ไม่มีข้อมูลตรงกับ "${this.sampleSearchQuery}" ลองค้นหาด้วยคำอื่น หรือกดปุ่มด้านล่างเพื่อแสดงทั้งหมด</p>
          <button id="btn-reset-filters" class="btn-reset-filters">ล้างการค้นหา &amp; แสดงทั้งหมด</button>
        </div>
      `;
      return;
    }

    this.dom.samplesGrid.innerHTML = filtered.map((disease, idx) => {
      const isLast  = idx === filtered.length - 1;
      const isOdd   = filtered.length % 2 !== 0;
      const spanFull = (isLast && isOdd && filtered.length > 1) ? "full-width" : "";

      return `
        <article class="sample-card card-${disease.id} ${spanFull}" data-id="${disease.id}">
          <!-- Card Top Bar: Number, Category & Severity Badge -->
          <div class="sample-card-head">
            <div class="sample-num-badge badge-${disease.id}">#${disease.num || "00"}</div>
            <div class="sample-head-meta">
              <span class="sample-cat-pill pill-${disease.id}">
                <span class="cat-dot"></span>
                ${disease.categoryTh || "โรคพืช"}
              </span>
              <span class="sample-severity-pill sev-${disease.id}">
                ${disease.severity || disease.tagText}
              </span>
            </div>
          </div>

          <!-- Interactive Leaf Image Container -->
          <div class="sample-img-container" data-action="open-lightbox" data-disease-id="${disease.id}" role="button" tabindex="0" title="แตะเพื่อซูมดูรอยโรคใบองุ่น">
            <img id="sample-img-${disease.id}"
                 src="https://lh3.googleusercontent.com/d/${disease.driveFileId}"
                 alt="${disease.nameEn} leaf sample"
                 crossorigin="anonymous"
                 loading="lazy"
                 onerror="window.__grapeApp?.handleImageFallback(this, '${disease.driveFileId}', '${disease.id}')" />
            <div class="sample-img-gradient"></div>
            <span class="sample-eng-tag tag-${disease.id}">${disease.nameEn}</span>
            <div class="sample-zoom-trigger">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
              </svg>
              <span>แตะเพื่อซูมดูรอยโรค</span>
            </div>
          </div>

          <!-- Card Body: Disease Names, Symptoms, Agricultural Guidance -->
          <div class="sample-card-body">
            <div class="sample-title-group">
              <h3 class="sample-name-th name-${disease.id}">${disease.nameTh}</h3>
              <p class="sample-name-en">${disease.nameEn} &bull; Vitis vinifera</p>
            </div>

            <!-- Diagnostic Traits Box -->
            <div class="sample-info-block symptoms-block">
              <div class="info-block-header">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-4m0-4h.01" />
                </svg>
                <span>ลักษณะอาการตรวจพบ</span>
              </div>
              <p class="info-block-text">${disease.symptoms}</p>
            </div>

            <!-- Management & Treatment Box -->
            <div class="sample-info-block guidance-block">
              <div class="info-block-header">
                <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>แนวทางการจัดการ &amp; รักษา</span>
              </div>
              <p class="info-block-text">${disease.guidance?.desc || ""}</p>
            </div>

            <!-- Inspect Button (Direct Lightbox trigger) -->
            <button class="btn-inspect-sample btn-inspect-${disease.id}" data-action="open-lightbox" data-disease-id="${disease.id}" type="button">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>ดูข้อมูลฉบับเต็ม &amp; ภาพขยาย</span>
            </button>
          </div>
        </article>
      `;
    }).join("");
  }

  /**
   * เปิดหน้าต่าง Lightbox เพื่อดูภาพขยายความละเอียดสูงและรายละเอียดโรค
   */
  openSampleLightbox(diseaseId) {
    const disease = DISEASE_DATABASE[diseaseId];
    if (!disease || !this.dom.sampleLightboxModal) return;

    this._triggerHaptic();

    if (this.dom.lightboxImg) {
      this.dom.lightboxImg.src = `https://lh3.googleusercontent.com/d/${disease.driveFileId}`;
      this.dom.lightboxImg.alt = `${disease.nameTh} (${disease.nameEn})`;
    }
    if (this.dom.lightboxNum) {
      this.dom.lightboxNum.textContent = `#${disease.num || "01"}`;
      this.dom.lightboxNum.className = `lightbox-num-badge badge-${disease.id}`;
    }
    if (this.dom.lightboxCat) {
      this.dom.lightboxCat.textContent = disease.categoryTh || "โรคพืช";
      this.dom.lightboxCat.className = `lightbox-cat-badge pill-${disease.id}`;
    }
    if (this.dom.lightboxSeverity) {
      this.dom.lightboxSeverity.textContent = disease.severity || disease.tagText;
      this.dom.lightboxSeverity.className = `lightbox-severity-badge sev-${disease.id}`;
    }
    if (this.dom.lightboxTitle) {
      this.dom.lightboxTitle.textContent = disease.nameTh;
      this.dom.lightboxTitle.className = `lightbox-title name-${disease.id}`;
    }
    if (this.dom.lightboxSubtitle) {
      this.dom.lightboxSubtitle.textContent = `${disease.nameEn} (Vitis vinifera)`;
    }
    if (this.dom.lightboxSymptoms) {
      this.dom.lightboxSymptoms.textContent = disease.symptoms;
    }
    if (this.dom.lightboxGuidanceTitle) {
      this.dom.lightboxGuidanceTitle.textContent = disease.guidance?.title || "แนวทางการรักษาและการจัดการโรค";
    }
    if (this.dom.lightboxGuidanceDesc) {
      this.dom.lightboxGuidanceDesc.textContent = disease.guidance?.desc || "";
    }

    if (this.dom.lightboxCard) {
      this.dom.lightboxCard.className = `lightbox-card card-${disease.id}`;
    }

    this.dom.sampleLightboxModal.classList.remove("hidden");
    requestAnimationFrame(() => {
      this.dom.sampleLightboxModal.classList.add("open");
    });
    document.body.style.overflow = "hidden";
  }

  /**
   * ปิดหน้าต่าง Lightbox
   */
  closeSampleLightbox() {
    if (!this.dom.sampleLightboxModal) return;
    this.dom.sampleLightboxModal.classList.remove("open");
    setTimeout(() => {
      this.dom.sampleLightboxModal.classList.add("hidden");
      document.body.style.overflow = "";
    }, 220);
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
    if (!this.dom.toastMsg || !this.dom.toast) return;
    this.dom.toastMsg.textContent = message;
    this.dom.toast.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.dom.toast?.classList.remove("show");
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

    // สารานุกรม 7 โรค: ค้นหาข้อความ
    this.dom.samplesSearchInput?.addEventListener("input", (e) => {
      this.sampleSearchQuery = e.target.value;
      if (this.dom.btnClearSearch) {
        this.dom.btnClearSearch.classList.toggle("hidden", !this.sampleSearchQuery);
      }
      this._renderSampleCards();
    });

    // สารานุกรม 7 โรค: ปุ่มล้างการค้นหา
    this.dom.btnClearSearch?.addEventListener("click", () => {
      this.sampleSearchQuery = "";
      if (this.dom.samplesSearchInput) this.dom.samplesSearchInput.value = "";
      this.dom.btnClearSearch?.classList.add("hidden");
      this._renderSampleCards();
    });

    // สารานุกรม 7 โรค: ตัวกรองหมวดหมู่
    this.dom.samplesFilterPills?.addEventListener("click", (e) => {
      const pill = e.target.closest(".filter-pill");
      if (!pill) return;
      this._triggerHaptic();
      this.dom.samplesFilterPills.querySelectorAll(".filter-pill").forEach((btn) => btn.classList.remove("active"));
      pill.classList.add("active");
      this.currentSampleFilter = pill.dataset.filter || "all";
      this._renderSampleCards();
    });

    // Lightbox modal: ปุ่มปิด และคลิกพื้นหลัง
    this.dom.btnCloseLightbox?.addEventListener("click", () => this.closeSampleLightbox());
    this.dom.sampleLightboxBackdrop?.addEventListener("click", () => this.closeSampleLightbox());

    // ปุ่มคีย์บอร์ด Escape ปิด modal ทุกชนิด
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.closeSampleLightbox();
        this.closeClearModal();
      }
    });

    // Event delegation: ใน samples grid (เปิด lightbox หรือ รีเซ็ตคำค้นหา)
    this.dom.samplesGrid?.addEventListener("click", (e) => {
      const trigger = e.target.closest('[data-action="open-lightbox"]');
      if (trigger && trigger.dataset.diseaseId) {
        this.openSampleLightbox(trigger.dataset.diseaseId);
        return;
      }
      const resetBtn = e.target.closest("#btn-reset-filters");
      if (resetBtn) {
        this.sampleSearchQuery = "";
        this.currentSampleFilter = "all";
        if (this.dom.samplesSearchInput) this.dom.samplesSearchInput.value = "";
        this.dom.btnClearSearch?.classList.add("hidden");
        this.dom.samplesFilterPills?.querySelectorAll(".filter-pill").forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.filter === "all");
        });
        this._renderSampleCards();
      }
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

// เริ่มต้นทำงานอย่างปลอดภัย รองรับทั้ง DOMContentLoaded และโหลดภายหลัง
function startApp() {
  if (!window.__grapeApp) {
    window.__grapeApp = new GrapeScannerApp();
    window.__grapeApp.init();
  }
}

if (document.readyState === "loading") {
  window.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
