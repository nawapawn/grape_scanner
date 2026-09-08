/**
 * ==========================================================================
 * ฐานข้อมูลองค์ความรู้โรคใบองุ่น 7 ชนิด (โมเดล BK5h9OhwU)
 * ==========================================================================
 */

const DISEASE_DATABASE = {
  anthracnose: {
    id: "anthracnose",
    modelLabel: "โรคแอนแทรกโนสใบองุ่น",
    nameTh: "โรคแอนแทรคโนส",
    nameEn: "Anthracnose",
    tagText: "แผลสะเก็ด",
    tagStyle: "bg-slate-900 text-white",
    badgeStyle: "bg-rose-50 text-rose-700 border-rose-200",
    driveFileId: "1haAYHy1nlXCR4XIlq70eFT_Gn-esGvDP",
    isHealthy: false,
    symptoms: "จุดแผลกลมสีน้ำตาลไหม้ ขอบเข้มคล้ายตานก (Bird's eye) กึ่งกลางแผลแห้งกรอบและฉีกขาดง่าย",
    guidance: {
      title: "การจัดการโรคแอนแทรคโนส (Anthracnose):",
      desc: "ตัดแต่งกิ่งและเก็บใบที่มีแผลไปทำลาย หลีกเลี่ยงการรดน้ำโดนพุ่มใบช่วงค่ำ พ่นสารป้องกันกำจัดเชื้อรากลุ่มคอปเปอร์ หรือไดฟีโนโคนาโซล"
    }
  },

  brownspot: {
    id: "brownspot",
    modelLabel: "โรคใบจุดสีน้ำตาลในองุ่น",
    nameTh: "โรคใบจุดสีน้ำตาล",
    nameEn: "Brown Spot",
    tagText: "เชื้อรา",
    tagStyle: "bg-slate-800 text-white",
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200",
    driveFileId: "1m4tmfTp9KwvYAJxlfxQmSDR97QlcagEY",
    isHealthy: false,
    symptoms: "แผลจุดสีน้ำตาลเข้ม กระจายตามแนวเส้นใบ มีวงสีเหลืองจางๆ ล้อมรอบขอบแผล",
    guidance: {
      title: "การจัดการโรคใบจุดสีน้ำตาล (Brown Spot):",
      desc: "ตัดแต่งทรงพุ่มให้โปร่งเพื่อลดความชื้นสะสม เก็บเศษซากใบใต้ต้นออกนอกแปลง พ่นสารป้องกันเชื้อรากลุ่มแมนโคเซบ หรือโพรพิเนบ"
    }
  },

  downymildew: {
    id: "downymildew",
    modelLabel: "โรคราน้ำค้างใบองุ่น",
    nameTh: "โรคราน้ำค้าง",
    nameEn: "Downy Mildew",
    tagText: "แผลฉ่ำน้ำ",
    tagStyle: "bg-slate-800 text-white",
    badgeStyle: "bg-yellow-50 text-yellow-800 border-yellow-200",
    driveFileId: "1B5yzfc1su7p2wVnWOAwgTw-qvWwe7ytw",
    isHealthy: false,
    symptoms: "ด้านบนใบมีรอยด่างเหลืองคล้ายหยดน้ำมัน (Oil spot) ด้านใต้ใบมีเส้นใยราสีขาวอมเทาฟู",
    guidance: {
      title: "การจัดการโรคราน้ำค้าง (Downy Mildew):",
      desc: "ระวังช่วงฝนตกชุก หากพบแผลหยดน้ำมันให้เด็ดทำลายทันที พ่นสารกลุ่มไดเมโทมอร์ฟ หรือเมทาแลกซิลสลับกลุ่มยาเพื่อป้องกันเชื้อดื้อยา"
    }
  },

  mites: {
    id: "mites",
    modelLabel: "โรคใบองุ่นที่เกิดจากไรศัตรูพืช",
    nameTh: "โรคไรองุ่น / ไรสนิม",
    nameEn: "Mites Disease",
    tagText: "ศัตรูพืช",
    tagStyle: "bg-slate-800 text-white",
    badgeStyle: "bg-orange-50 text-orange-700 border-orange-200",
    driveFileId: "1ntEN-t330_CZMI1Ty5D-fz9PQbtZIDnJ",
    isHealthy: false,
    symptoms: "ผิวใบปูดนูนเป็นปุ่มปม ใต้ใบมีคราบฝ้าสีสนิมหรือน้ำตาลไหม้ ขอบใบหงิกงอ แคะแกร็น",
    guidance: {
      title: "การจัดการไรองุ่น / ไรสนิม (Mites):",
      desc: "ตัดใบที่ปูดพองทิ้ง พ่นกำมะถันผงละลายน้ำช่วงเช้าที่แดดไม่จัด หรือใช้น้ำมันปิโตรเลียมสเปรย์ออยล์ตัดวงจรไข่"
    }
  },

  normal: {
    id: "normal",
    modelLabel: "ใบองุ่นปกติ",
    nameTh: "ใบองุ่นปกติ สมบูรณ์",
    nameEn: "Normal Leaf",
    tagText: "สมบูรณ์",
    tagStyle: "bg-emerald-700 text-white",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200",
    driveFileId: "1Piqmcxafg5_JHsSuxXa8kEwbO_ljJN9L",
    isHealthy: true,
    symptoms: "แผ่นใบเรียบ สีเขียวสม่ำเสมอ เส้นใบแข็งแรง คมชัด ไร้รอยแผลหรือคราบรา",
    guidance: {
      title: "สภาพใบองุ่นสมบูรณ์และแข็งแรง:",
      desc: "ใบสุขภาพดี ควรรักษาระดับความชื้นในดินให้เหมาะสม บำรุงธาตุอาหารหลักและจุลธาตุสม่ำเสมอเพื่อคงภูมิต้านทานโรค"
    }
  },

  powdery: {
    id: "powdery",
    modelLabel: "โรคราแป้งใบองุ่น",
    nameTh: "โรคราแป้ง",
    nameEn: "Powdery Mildew",
    tagText: "ผงแป้งขาว",
    tagStyle: "bg-slate-800 text-white",
    badgeStyle: "bg-slate-100 text-slate-700 border-slate-300",
    driveFileId: "1kpIutlLZXf5Hv3wLzA9w5qeHouGavs-R",
    isHealthy: false,
    symptoms: "มีผงสปอร์สีขาวหรือเทาคล้ายผงแป้งเคลือบกระจายบนผิวใบ ใบแห้งกระด้าง ขอบม้วนงอ",
    guidance: {
      title: "การจัดการโรคราแป้ง (Powdery Mildew):",
      desc: "ระบาดได้ดีในอากาศแห้งแต่ร่มครึ้ม ฉีดพ่นกำมะถันผงชนิดละลายน้ำช่วงเช้า หรือใช้สารกลุ่มไตรอะโซล หลีกเลี่ยงช่วงดอกบาน"
    }
  },

  shothole: {
    id: "shothole",
    modelLabel: "โรคใบพรุนในองุ่น",
    nameTh: "โรคใบจุดรูพรุน (ช็อตโฮล)",
    nameEn: "Shot Hole Disease",
    tagText: "เนื้อเยื่อหลุด",
    tagStyle: "bg-slate-800 text-white",
    badgeStyle: "bg-stone-100 text-stone-700 border-stone-300",
    driveFileId: "1b1uIb_tAvNyd1QQLkeZg21uomazbJyfQ",
    isHealthy: false,
    symptoms: "กึ่งกลางแผลแห้งตายและหลุดร่วง เกิดเป็นรูพรุนกลมกระจายทั่วใบคล้ายรอยกระสุนปืนลูกซอง",
    guidance: {
      title: "การจัดการโรคใบจุดรูพรุน (Shot Hole):",
      desc: "เก็บกวาดใบที่ร่วงออกนอกแปลง พ่นสารป้องกันเชื้อรากลุ่มคอปเปอร์ช่วงก่อนแตกใบอ่อน และพ่นซ้ำเมื่อพบอาการจุดกลมบนใบอ่อน"
    }
  }
};

/** รายการโรคทั้งหมด 7 ชนิด สำหรับแสดงในการ์ดตัวอย่าง */
const DISEASE_LIST = Object.values(DISEASE_DATABASE);

/**
 * ฟังก์ชันเทียบเคียงผลลัพธ์จากโมเดล AI เข้ากับฐานข้อมูลโรค
 * รองรับทั้งข้อความเต็มจากโมเดล และคำค้นสำรอง (ป้องกันปัญหาตัวสะกด)
 * @param {string} rawLabel ชื่อคลาสที่ส่งมาจากโมเดล
 * @returns {object} ข้อมูลโรค
 */
function resolveDiseaseInfo(rawLabel) {
  if (!rawLabel) return DISEASE_DATABASE.normal;

  const trimmed = rawLabel.trim();
  const lower = trimmed.toLowerCase();

  // 1. ตรวจสอบตรงกับ Label ของ Teachable Machine
  for (const item of DISEASE_LIST) {
    if (item.modelLabel === trimmed) {
      return item;
    }
  }

  // 2. ตรวจสอบตรงกับ ID หรือชื่อภาษาอังกฤษ
  for (const item of DISEASE_LIST) {
    if (item.id === lower || item.nameEn.toLowerCase() === lower) {
      return item;
    }
  }

  // 3. ตรวจสอบคำค้นสำคัญ (รองรับตัวสะกดทั้ง ก และ ค, ใบพรุน และ รูพรุน)
  if (lower.includes("แอนแทรก") || lower.includes("แอนแทรค") || lower.includes("anthracnose")) {
    return DISEASE_DATABASE.anthracnose;
  }
  if (lower.includes("ใบพรุน") || lower.includes("รูพรุน") || lower.includes("shot")) {
    return DISEASE_DATABASE.shothole;
  }
  if (lower.includes("ราน้ำค้าง") || lower.includes("downy")) {
    return DISEASE_DATABASE.downymildew;
  }
  if (lower.includes("ราแป้ง") || lower.includes("powdery")) {
    return DISEASE_DATABASE.powdery;
  }
  if (lower.includes("จุดสีน้ำตาล") || (lower.includes("จุด") && lower.includes("น้ำตาล")) || lower.includes("brown")) {
    return DISEASE_DATABASE.brownspot;
  }
  if (lower.includes("ไร") || lower.includes("mite")) {
    return DISEASE_DATABASE.mites;
  }
  if (lower.includes("ปกติ") || lower.includes("สมบูรณ์") || lower.includes("normal") || lower.includes("healthy")) {
    return DISEASE_DATABASE.normal;
  }

  return DISEASE_DATABASE.normal;
}

/** ข้อความคำแนะนำการใช้งาน */
const MASCOT_TIPS = [
  "จัดระยะห่างกล้อง 15-20 ซม. ให้แสงสว่างทั่วถึงทั้งแผ่นใบ",
  "ส่องให้เห็นทั้งแผ่นใบและเส้นใบเพื่อผลการวิเคราะห์ที่แม่นยำ",
  "หากแสงน้อย สามารถกดปุ่มไฟฉายด้านบนเพื่อเปิดแฟลชกล้องหลัง",
  "กดปุ่มชัตเตอร์ตรงกลางเพื่อหยุดภาพนิ่งและบันทึกข้อมูลแปลง",
  "กดแท็บ 'ตัวอย่าง 7 โรค' เพื่อเปรียบเทียบอาการรอยแผลได้ทันที"
];
