/**
 * ==========================================================================
 * ตัวจัดการประวัติการสแกนและส่งออกข้อมูล (History & Storage Service)
 * ==========================================================================
 */

class HistoryService {
  constructor(storageKey = "grape_leaf_ai_records_v1") {
    this.storageKey = storageKey;
  }

  /**
   * ดึงรายการประวัติทั้งหมดที่บันทึกไว้ในเบราว์เซอร์
   * @returns {Array<object>} รายการประวัติ
   */
  getRecords() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error("Error reading scan history:", err);
      return [];
    }
  }

  /**
   * บันทึกผลการตรวจใหม่ลงใน LocalStorage
   * @param {object} recordData ข้อมูลการตรวจ
   * @returns {object} บันทึกที่สร้างขึ้น
   */
  addRecord({ className, probability, confidencePct, plot = "แปลงทั่วไป", diseaseInfo = null }) {
    const records = this.getRecords();
    const now = new Date();
    const dateStr = now.toLocaleDateString("th-TH", { day: "2-digit", month: "2-digit" });
    const timeStr = now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

    const uniqueSuffix = Math.random().toString(36).substring(2, 7);
    const newRecord = {
      id: `REC-${Date.now()}-${uniqueSuffix}`,
      timestamp: `${dateStr} ${timeStr}`,
      className,
      probability,
      confidencePct,
      plot: plot.trim() || "แปลงทั่วไป",
      diseaseId: diseaseInfo ? diseaseInfo.id : "unknown",
      nameTh: diseaseInfo ? diseaseInfo.nameTh : className,
      isHealthy: diseaseInfo ? diseaseInfo.isHealthy : false
    };

    records.unshift(newRecord);
    this._saveToStorage(records);
    return newRecord;
  }

  /**
   * ลบรายการประวัติตาม ID
   * @param {string} id รหัสบันทึก
   * @returns {boolean} สำเร็จหรือไม่
   */
  deleteRecord(id) {
    let records = this.getRecords();
    const initialLen = records.length;
    records = records.filter((r) => r.id !== id);
    this._saveToStorage(records);
    return records.length < initialLen;
  }

  /**
   * ล้างประวัติทั้งหมด
   */
  clearAll() {
    try {
      localStorage.removeItem(this.storageKey);
      return true;
    } catch (e) {
      console.error("Failed to clear history:", e);
      return false;
    }
  }

  /**
   * ส่งออกไฟล์ CSV พร้อม UTF-8 BOM เพื่อให้เปิดใน Excel ได้ภาษาไทยไม่เพี้ยน
   * @returns {boolean}
   */
  exportCSV() {
    const records = this.getRecords();
    if (records.length === 0) return false;

    let csv = "\uFEFFรหัสบันทึก,วันเวลา,แปลงหรือต้น,ชื่อโรค/สถานะ,ชื่อทางการแพทย์,ความมั่นใจ (%),สุขภาพใบ\n";

    records.forEach((r) => {
      const safeId = `"${r.id || ''}"`;
      const safeTime = `"${r.timestamp || ''}"`;
      const safePlot = `"${(r.plot || '').replace(/"/g, '""')}"`;
      const safeNameTh = `"${(r.nameTh || r.className || '').replace(/"/g, '""')}"`;
      const safeClass = `"${(r.className || '').replace(/"/g, '""')}"`;
      const safePct = `"${r.confidencePct || 0}"`;
      const safeStatus = r.isHealthy ? `"สมบูรณ์ (ปกติ)"` : `"พบโรค"`;

      csv += `${safeId},${safeTime},${safePlot},${safeNameTh},${safeClass},${safePct},${safeStatus}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `grape_leaf_scans_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  }

  /**
   * ตัวช่วยบันทึกลง LocalStorage
   * @private
   */
  _saveToStorage(records) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(records));
    } catch (err) {
      console.error("Failed to save to localStorage:", err);
    }
  }
}
