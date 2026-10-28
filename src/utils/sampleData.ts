/**
 * Initial sample engineering data: Virtual folders, P&ID documents,
 * realistic synthesized PDF byte generator, hotspots, and comprehensive RCA investigation.
 */
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DocumentItem, FolderItem, Hotspot, RCAInvestigation } from '../types';

export const INITIAL_FOLDERS: FolderItem[] = [
  { id: 'f-root', name: 'Root Project', parentId: null, createdAt: '2026-01-15' },
  { id: 'f-boiler', name: '01 - Steam & Boiler Island', parentId: 'f-root', createdAt: '2026-01-15' },
  { id: 'f-cooling', name: '02 - Cooling & Chilled Water', parentId: 'f-root', createdAt: '2026-01-16' },
  { id: 'f-gas', name: '03 - Fuel Gas & Metering', parentId: 'f-root', createdAt: '2026-01-17' },
];

export const INITIAL_DOCUMENTS: DocumentItem[] = [
  {
    id: 'doc-pid-101',
    name: 'PID-101-REV4-Boiler-Feedwater-Loop.pdf',
    folderId: 'f-boiler',
    size: 245760,
    pageCount: 2,
    uploadDate: '2026-10-18',
    title: 'Boiler Feedwater & High-Pressure Steam Circuit',
    description: 'P&ID schematic showing BFW pumps P-101A/B, Drum B-201, control loop FCV-104, and safety relief PSV-203.',
    equipmentTag: 'BFW-SYS-01',
    systemUnit: 'Unit 1 Power Block',
    isSample: true,
  },
  {
    id: 'doc-pid-204',
    name: 'PID-204-REV2-Chilled-Water-Circuit.pdf',
    folderId: 'f-cooling',
    size: 198400,
    pageCount: 1,
    uploadDate: '2026-10-20',
    title: 'Primary Chilled Water Loop & Heat Exchangers',
    description: 'Circulation pumps, plate heat exchangers, and cooling tower return manifold.',
    equipmentTag: 'CHW-SYS-02',
    systemUnit: 'Utility Substation',
    isSample: true,
  },
];

export const INITIAL_HOTSPOTS: Hotspot[] = [
  {
    id: 'hs-p101a',
    docId: 'doc-pid-101',
    pageNum: 1,
    x: 18.5,
    y: 56.5,
    width: 14.5,
    height: 19.5,
    label: 'P-101A BFW Pump',
    equipmentTag: 'P-101A',
    actionType: 'rca',
    rcaId: 'rca-101',
  },
  {
    id: 'hs-fcv104',
    docId: 'doc-pid-101',
    pageNum: 1,
    x: 52.0,
    y: 50.0,
    width: 11.0,
    height: 15.0,
    label: 'FCV-104 Feedwater Control Valve',
    equipmentTag: 'FCV-104',
    actionType: 'dropdown',
    dropdownOptions: [
      { id: 'opt-1', label: 'Valve Technical Specification Sheet', actionType: 'note', note: 'Fisher ET 6-inch Class 900. Equal percentage trim with hardened stellited seat.' },
      { id: 'opt-2', label: 'View Related P&ID (Chilled Water Loop)', actionType: 'doc', targetDocId: 'doc-pid-204', targetPageNum: 1 },
      { id: 'opt-3', label: 'I/P Positioner Calibration Record', actionType: 'note', note: 'Calibrated: 2026-09-02. Zero: 4.02mA (0%), Span: 19.98mA (100%). Travel time 3.2s.' },
    ],
  },
  {
    id: 'hs-psv203',
    docId: 'doc-pid-101',
    pageNum: 1,
    x: 77.0,
    y: 22.0,
    width: 10.5,
    height: 14.0,
    label: 'PSV-203 Safety Relief Valve',
    equipmentTag: 'PSV-203',
    actionType: 'note',
    note: 'SET PRESSURE: 125.0 barg (1813 psig).\nCertified Relieving Capacity: 145,000 kg/hr saturated steam.\nTested: 2026-04-12 by Bureau Veritas.\nNext pop test required: 2027-04.',
  },
  {
    id: 'hs-drum201',
    docId: 'doc-pid-101',
    pageNum: 1,
    x: 68.0,
    y: 35.0,
    width: 23.0,
    height: 20.0,
    label: 'B-201 Steam Drum & Level Control',
    equipmentTag: 'B-201',
    actionType: 'direct_link',
    directLink: {
      targetPageNum: 2,
    },
  },
];

export const INITIAL_RCA: RCAInvestigation = {
  id: 'rca-101',
  equipmentTag: 'P-101A',
  equipmentName: 'Multi-Stage Centrifugal Boiler Feed Pump',
  incidentTitle: 'Impeller Cavitation & Catastrophic Mechanical Seal Fracture on P-101A',
  incidentDate: '2026-10-14 03:42',
  plantUnit: 'Unit 1 Thermal Power Generation Block',
  severity: 'Critical',
  description: 'At 03:42 UTC, Boiler Feedwater Pump P-101A tripped on high non-drive-end (NDE) bearing vibration (24.8 mm/s RMS, trip limit 11.2 mm/s). Operators immediately observed clouds of flashing steam escaping from the DE mechanical seal gland and heavy metal-on-metal screeching sounds. High-pressure steam boiler level dropped to -120 mm before standby pump P-101B achieved full discharge flow.',
  fieldFacts: `1. Suction differential pressure (DP) transmitter PDT-101 was found showing 1.25 bar DP (normal < 0.25 bar). The alarm had been bypassed in the control room during midnight shift handover.\n2. Suction pressure dropped below deaerator vapor pressure (NPSHa < NPSHr), triggering severe acoustic cavitation.\n3. Mechanical seal faces (Silicon Carbide on Carbon) suffered complete thermal shattering due to vaporization of flush barrier water.\n4. Disassembly revealed 65% of the suction cone strainer basket was plugged with magnetite flakes dislodged after chemical cleaning.\n5. Thrust bearing shoes exhibited severe thermal scoring and babbitt wipedown.`,
  immediateActions: `1. P-101B auto-started and stabilized Drum B-201 level within 45 seconds, preventing turbine trip.\n2. P-101A electrically isolated (LOTO #26-1049) and process suction/discharge manual valves locked closed.\n3. Suction strainer basket removed; metallurgical lab retained scale samples.\n4. Seal cartridge replaced with spare Plan 23/53B dual pressurized cartridge.`,
  attachments: [
    {
      id: 'att-1',
      name: 'Fractured_Silicon_Carbide_Seal_Face.png',
      type: 'image/png',
      caption: 'Thermal stress cracking and radial shattering of primary silicon carbide mating ring recovered from P-101A seal cavity.',
      printSize: 'medium',
      storageKey: 'att-1',
      dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350"><rect width="600" height="350" fill="%231e293b"/><circle cx="300" cy="175" r="110" fill="none" stroke="%2394a3b8" stroke-width="28"/><circle cx="300" cy="175" r="85" fill="none" stroke="%2338bdf8" stroke-dasharray="12 8" stroke-width="4"/><path d="M 230 115 L 295 170 L 360 120" stroke="%23ef4444" stroke-width="4" fill="none"/><path d="M 295 170 L 320 260" stroke="%23ef4444" stroke-width="4" fill="none"/><text x="300" y="325" fill="%23f1f5f9" font-family="monospace" font-size="14" text-anchor="middle">METALLURGY LAB EXHIBIT A: RADIAL SEAL FRACTURE</text></svg>',
    },
    {
      id: 'att-2',
      name: 'Suction_Strainer_Magnetite_Scale.png',
      type: 'image/png',
      caption: 'Heavy magnetite iron-oxide scale agglomeration found obstructing 65% of the 40-mesh suction conical strainer basket.',
      printSize: 'medium',
      storageKey: 'att-2',
      dataUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="350" viewBox="0 0 600 350"><rect width="600" height="350" fill="%230f172a"/><polygon points="200,60 400,60 330,270 270,270" fill="%23334155" stroke="%2364748b" stroke-width="4"/><circle cx="300" cy="150" r="45" fill="%23d97706" opacity="0.85"/><circle cx="280" cy="180" r="30" fill="%23b45309" opacity="0.9"/><circle cx="330" cy="160" r="25" fill="%2378350f" opacity="0.9"/><text x="300" y="325" fill="%23f1f5f9" font-family="monospace" font-size="14" text-anchor="middle">EXHIBIT B: PLUGGED SUCTION STRAINER CONE</text></svg>',
    },
  ],
  fiveWhys: {
    problem: 'Boiler Feedwater Pump P-101A tripped on catastrophic vibration due to mechanical seal disintegration and cavitation.',
    whys: [
      'The pump experienced severe acoustic cavitation and vapor locking, causing dry running of the mechanical seal.',
      'Suction pressure dropped to 1.4 barg, causing Net Positive Suction Head Available (NPSHa) to drop well below the required 5.2m.',
      'The suction conical basket strainer suffered severe differential pressure blockage (1.25 bar DP) due to magnetite iron scale.',
      'The suction DP high alarm had been bypassed in the DCS during the previous shift and not logged in the handover journal.',
      'There was no mandatory interlock preventing alarm silencing on critical rotating equipment suction protection loops without Engineering Authorization.',
    ],
    rootCauseSummary: 'Inadequate procedural governance over DCS safety alarm bypassing, compounded by scale migration after acid cleaning that restricted pump suction and breached NPSH margins.',
    correctiveAction: '1. Reprogram DCS logic to make Suction DP > 0.8 bar a hard trip with password-locked bypass requires Shift Manager key.\n2. Institute physical differential pressure gauges with local flags at pump skids.\n3. Mandate 100% inspection of strainers 72 hours post chemical boil-out.',
    responsibleParty: 'Lead Reliability Engineer & DCS Superintendent',
    targetDate: '2026-11-15',
  },
  fishbone: {
    effect: 'P-101A Catastrophic Cavitation & Seal Fracture',
    bones: {
      manpower: [
        { id: 'mp-1', text: 'Bypassed DCS alarm not documented in shift log', isPrimaryRoot: true },
        { id: 'mp-2', text: 'Operators did not inspect local suction gauge on rounds' },
      ],
      machine: [
        { id: 'mc-1', text: 'Silicon-carbide seal face thermal shock fracture' },
        { id: 'mc-2', text: 'NDE bearing radial vibration excursion >24 mm/s' },
      ],
      material: [
        { id: 'mt-1', text: 'Magnetite oxide flakes loosened from boiler tube walls' },
        { id: 'mt-2', text: 'Seal flush fluid flashed into steam inside cavity' },
      ],
      method: [
        { id: 'me-1', text: 'Absence of interlock lockout policy for critical suction alarms', isPrimaryRoot: true },
        { id: 'me-2', text: 'Chemical cleaning passivation flush duration insufficient' },
      ],
      measurement: [
        { id: 'ms-1', text: 'PDT-101 transmitter impulse lines partially clogged with sludge' },
        { id: 'ms-2', text: 'Vibration monitoring polling rate set to 10s intervals' },
      ],
      environment: [
        { id: 'en-1', text: 'Extreme boiler feed load ramp during sudden grid demand spike' },
        { id: 'en-2', text: 'High ambient temperature (38°C) reduced seal cooler efficiency' },
      ],
    },
  },
  faultTree: {
    topEvent: 'Loss of High-Pressure BFW Delivery from P-101A',
    nodes: [
      { id: 'node-top', parentId: null, type: 'top', label: 'Loss of High-Pressure BFW Delivery from P-101A', code: 'T1' },
      { id: 'gate-1', parentId: 'node-top', type: 'gate', gateType: 'OR', label: 'Failure Modes', code: 'G1' },
      { id: 'gate-cav', parentId: 'gate-1', type: 'gate', gateType: 'AND', label: 'Suction Cavitation Event', code: 'G2' },
      { id: 'gate-seal', parentId: 'gate-1', type: 'gate', gateType: 'OR', label: 'Mechanical Failure', code: 'G3' },
      { id: 'be-strainer', parentId: 'gate-cav', type: 'basic_event', label: 'Suction Strainer Magnetite Clogging', code: 'E1', probability: 0.85 },
      { id: 'be-bypass', parentId: 'gate-cav', type: 'basic_event', label: 'DCS Alarm Unreported Bypass', code: 'E2', probability: 0.95 },
      { id: 'be-seal-dry', parentId: 'gate-seal', type: 'basic_event', label: 'Seal Barrier Fluid Flash / Dry Run', code: 'E3', probability: 0.90 },
      { id: 'be-bearing', parentId: 'gate-seal', type: 'basic_event', label: 'Thrust Bearing Hydrodynamic Collapse', code: 'E4', probability: 0.40 },
    ],
  },
  lastUpdated: '2026-10-24 16:30',
};

/**
 * Generates an authentic industrial multi-page P&ID diagram PDF with real vector drawings,
 * equipment vessels, piping loops, instrument bubbles, and engineering title blocks!
 */
export async function generateSamplePidPdf(docId: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);
  const fontSans = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSansBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  if (docId === 'doc-pid-204') {
    // Single page Chilled Water schematic
    const page = pdfDoc.addPage([1190, 842]); // A3 landscape
    drawTitleBlock(page, fontSans, fontSansBold, fontMono, 'CHILLED WATER CIRCULATION SYSTEM', 'PID-CHW-204-REV-2', '1 OF 1');
    drawChilledWaterSchematic(page, fontSans, fontSansBold, fontMono);
    return await pdfDoc.save();
  }

  // Multi-page Boiler Steam & Water Loop
  // Page 1: Main Boiler Feedwater & Steam Drum Circuit
  const page1 = pdfDoc.addPage([1190, 842]);
  drawTitleBlock(page1, fontSans, fontSansBold, fontMono, 'BOILER FEEDWATER & STEAM DRUM CIRCUIT', 'PID-BFW-101-REV-4', '1 OF 2');
  drawBoilerFeedwaterSchematic(page1, fontSans, fontSansBold, fontMono);

  // Page 2: Deaerator & Condensate Polishing Section
  const page2 = pdfDoc.addPage([1190, 842]);
  drawTitleBlock(page2, fontSans, fontSansBold, fontMono, 'DEAERATOR & CONDENSATE STORAGE SECTION', 'PID-BFW-101-REV-4', '2 OF 2');
  drawDeaeratorSchematic(page2, fontSans, fontSansBold, fontMono);

  return await pdfDoc.save();
}

function drawTitleBlock(
  page: any,
  fontSans: any,
  fontSansBold: any,
  fontMono: any,
  title: string,
  dwgNo: string,
  sheet: string
) {
  const { width, height } = page.getSize();
  const darkNavy = rgb(0.08, 0.12, 0.2);
  const grayBorder = rgb(0.2, 0.28, 0.4);
  const textWhite = rgb(0.95, 0.97, 1.0);
  const textAmber = rgb(0.95, 0.65, 0.15);

  // Drawing outer border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderWidth: 2,
    borderColor: grayBorder,
    color: rgb(0.98, 0.99, 1.0),
  });

  // Inner border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderWidth: 1,
    borderColor: grayBorder,
    color: rgb(0.96, 0.98, 1.0),
  });

  // Title block rectangle in bottom-right corner
  const tbW = 420;
  const tbH = 100;
  const tbX = width - 30 - tbW;
  const tbY = 30;

  page.drawRectangle({
    x: tbX,
    y: tbY,
    width: tbW,
    height: tbH,
    color: darkNavy,
    borderWidth: 1.5,
    borderColor: grayBorder,
  });

  page.drawText('APEX POWER & PROCESS ENGINEERING', {
    x: tbX + 15,
    y: tbY + 78,
    size: 13,
    font: fontSansBold,
    color: textAmber,
  });

  page.drawText(title, {
    x: tbX + 15,
    y: tbY + 54,
    size: 12,
    font: fontSansBold,
    color: textWhite,
  });

  page.drawText(`DRAWING NO: ${dwgNo}`, {
    x: tbX + 15,
    y: tbY + 30,
    size: 10,
    font: fontMono,
    color: textWhite,
  });

  page.drawText(`SHEET: ${sheet} | REV: 4 | STATUS: AS-BUILT`, {
    x: tbX + 15,
    y: tbY + 12,
    size: 9,
    font: fontSans,
    color: rgb(0.7, 0.8, 0.9),
  });

  // Top header label
  page.drawText('CRITICAL PROCESS FLOW & INSTRUMENTATION DIAGRAM (P&ID)', {
    x: 45,
    y: height - 52,
    size: 11,
    font: fontSansBold,
    color: rgb(0.15, 0.25, 0.4),
  });
}

function drawBoilerFeedwaterSchematic(page: any, fontSans: any, fontSansBold: any, fontMono: any) {
  const lineCol = rgb(0.12, 0.22, 0.38);
  const stmCol = rgb(0.85, 0.25, 0.2);
  const tagCol = rgb(0.08, 0.38, 0.74);

  // 1. STEAM DRUM B-201 (Top Right)
  const drumX = 750;
  const drumY = 480;
  const drumW = 280;
  const drumH = 110;

  // Drum vessel body
  page.drawRectangle({
    x: drumX,
    y: drumY,
    width: drumW,
    height: drumH,
    borderWidth: 3,
    borderColor: lineCol,
    color: rgb(0.92, 0.95, 0.98),
  });

  // Drum dished heads (circles on ends)
  page.drawCircle({
    x: drumX,
    y: drumY + drumH / 2,
    size: drumH / 2,
    borderWidth: 3,
    borderColor: lineCol,
    color: rgb(0.92, 0.95, 0.98),
  });
  page.drawCircle({
    x: drumX + drumW,
    y: drumY + drumH / 2,
    size: drumH / 2,
    borderWidth: 3,
    borderColor: lineCol,
    color: rgb(0.92, 0.95, 0.98),
  });

  // Label Steam Drum
  page.drawText('STEAM DRUM B-201', {
    x: drumX + 60,
    y: drumY + 65,
    size: 14,
    font: fontSansBold,
    color: lineCol,
  });
  page.drawText('DESIGN PRESS: 135 barg | TEMP: 335°C', {
    x: drumX + 45,
    y: drumY + 45,
    size: 9,
    font: fontMono,
    color: rgb(0.3, 0.4, 0.5),
  });

  // Steam outlet line at top of Drum (Red)
  page.drawLine({
    start: { x: drumX + 140, y: drumY + drumH },
    end: { x: drumX + 140, y: drumY + drumH + 110 },
    thickness: 4,
    color: stmCol,
  });
  page.drawLine({
    start: { x: drumX + 140, y: drumY + drumH + 110 },
    end: { x: 1120, y: drumY + drumH + 110 },
    thickness: 4,
    color: stmCol,
  });
  page.drawText('16"-STM-201-AS TO HIGH-PRESSURE TURBINE', {
    x: 880,
    y: drumY + drumH + 120,
    size: 9,
    font: fontMono,
    color: stmCol,
  });

  // Safety Relief Valve PSV-203 on steam line
  const psvX = 890;
  const psvY = drumY + drumH + 110;
  page.drawCircle({
    x: psvX,
    y: psvY + 35,
    size: 16,
    borderWidth: 2,
    borderColor: lineCol,
    color: rgb(1, 1, 1),
  });
  page.drawText('PSV', { x: psvX - 11, y: psvY + 39, size: 8, font: fontSansBold, color: lineCol });
  page.drawText('203', { x: psvX - 9, y: psvY + 28, size: 8, font: fontMono, color: lineCol });
  page.drawLine({ start: { x: psvX, y: psvY }, end: { x: psvX, y: psvY + 19 }, thickness: 2, color: lineCol });

  // 2. CENTRIFUGAL PUMPS P-101A and P-101B (Bottom Left)
  // P-101A (Active incident pump)
  const pumpAX = 220;
  const pumpAY = 260;
  drawCentrifugalPump(page, pumpAX, pumpAY, 'P-101A', 'BOILER FEED PUMP A (MOTOR DRIVEN)', lineCol, fontSansBold, fontMono, true);

  // P-101B (Standby pump)
  const pumpBX = 220;
  const pumpBY = 110;
  drawCentrifugalPump(page, pumpBX, pumpBY, 'P-101B', 'BOILER FEED PUMP B (STANDBY)', lineCol, fontSansBold, fontMono, false);

  // Main Suction Header from Deaerator
  page.drawLine({ start: { x: 50, y: 380 }, end: { x: 130, y: 380 }, thickness: 5, color: lineCol });
  page.drawLine({ start: { x: 130, y: 380 }, end: { x: 130, y: 110 }, thickness: 4, color: lineCol });
  page.drawLine({ start: { x: 130, y: pumpAY }, end: { x: pumpAX - 35, y: pumpAY }, thickness: 4, color: lineCol });
  page.drawLine({ start: { x: 130, y: pumpBY }, end: { x: pumpBX - 35, y: pumpBY }, thickness: 4, color: lineCol });

  page.drawText('12"-BFW-101-CS FROM DEAERATOR DA-100 (PG 2)', {
    x: 55,
    y: 390,
    size: 9,
    font: fontMono,
    color: tagCol,
  });

  // Suction Strainers on lines
  drawStrainer(page, 155, pumpAY, 'STR-101A', fontMono);
  drawStrainer(page, 155, pumpBY, 'STR-101B', fontMono);

  // Discharge lines from P-101A & P-101B joining into main feedwater header
  page.drawLine({ start: { x: pumpAX + 35, y: pumpAY }, end: { x: 380, y: pumpAY }, thickness: 4, color: lineCol });
  page.drawLine({ start: { x: pumpAX + 35, y: pumpBY }, end: { x: 380, y: pumpBY }, thickness: 4, color: lineCol });
  page.drawLine({ start: { x: 380, y: pumpBY }, end: { x: 380, y: 360 }, thickness: 4, color: lineCol });

  // Feedwater Control Valve FCV-104 on main header
  const fcvX = 580;
  const fcvY = 360;
  page.drawLine({ start: { x: 380, y: 360 }, end: { x: 750, y: 360 }, thickness: 4, color: lineCol });
  // Control Valve Symbol (Bowtie with diaphragm actuator)
  drawControlValve(page, fcvX, fcvY, 'FCV', '104', lineCol, fontSansBold, fontMono);

  // Feed line continuing to Drum B-201
  page.drawLine({ start: { x: 750, y: 360 }, end: { x: 800, y: 360 }, thickness: 4, color: lineCol });
  page.drawLine({ start: { x: 800, y: 360 }, end: { x: 800, y: drumY }, thickness: 4, color: lineCol });

  page.drawText('8"-BFW-104-CS HIGH PRESSURE FEED TO DRUM', {
    x: 430,
    y: 345,
    size: 9,
    font: fontMono,
    color: tagCol,
  });

  // Instruments on Drum (Level Transmitter LT-201, Pressure Transmitter PT-202)
  drawInstrumentBubble(page, drumX + 60, drumY - 50, 'LT', '201', lineCol, fontSansBold, fontMono);
  page.drawLine({ start: { x: drumX + 60, y: drumY }, end: { x: drumX + 60, y: drumY - 32 }, thickness: 1.5, color: lineCol });

  drawInstrumentBubble(page, drumX + 220, drumY - 50, 'PT', '202', lineCol, fontSansBold, fontMono);
  page.drawLine({ start: { x: drumX + 220, y: drumY }, end: { x: drumX + 220, y: drumY - 32 }, thickness: 1.5, color: lineCol });
}

function drawDeaeratorSchematic(page: any, fontSans: any, fontSansBold: any, fontMono: any) {
  const lineCol = rgb(0.12, 0.22, 0.38);
  const tagCol = rgb(0.08, 0.38, 0.74);

  // Deaerator Vessel DA-100 (Dome on top of horizontal storage tank)
  const tankX = 350;
  const tankY = 380;
  const tankW = 500;
  const tankH = 150;

  // Horizontal storage vessel
  page.drawRectangle({
    x: tankX,
    y: tankY,
    width: tankW,
    height: tankH,
    borderWidth: 3,
    borderColor: lineCol,
    color: rgb(0.92, 0.95, 0.98),
  });

  // Dome tower on top
  page.drawRectangle({
    x: tankX + 180,
    y: tankY + tankH,
    width: 140,
    height: 120,
    borderWidth: 3,
    borderColor: lineCol,
    color: rgb(0.92, 0.95, 0.98),
  });

  page.drawText('DEAERATOR DOME DA-100', {
    x: tankX + 190,
    y: tankY + tankH + 80,
    size: 10,
    font: fontSansBold,
    color: lineCol,
  });

  page.drawText('STORAGE TANK TK-100', {
    x: tankX + 185,
    y: tankY + 90,
    size: 13,
    font: fontSansBold,
    color: lineCol,
  });
  page.drawText('CAPACITY: 95 m³ | OPERATING PRESS: 4.5 barg', {
    x: tankX + 150,
    y: tankY + 68,
    size: 9,
    font: fontMono,
    color: rgb(0.3, 0.4, 0.5),
  });

  // Suction downcomer pipe to Page 1
  page.drawLine({ start: { x: tankX + 120, y: tankY }, end: { x: tankX + 120, y: 160 }, thickness: 5, color: lineCol });
  page.drawLine({ start: { x: tankX + 120, y: 160 }, end: { x: 100, y: 160 }, thickness: 5, color: lineCol });

  page.drawText('12"-BFW-101-CS DOWNCOMER TO BFW PUMPS P-101A/B (CONTINUED ON PG 1)', {
    x: 100,
    y: 175,
    size: 10,
    font: fontMono,
    color: tagCol,
  });
}

function drawChilledWaterSchematic(page: any, fontSans: any, fontSansBold: any, fontMono: any) {
  const lineCol = rgb(0.12, 0.22, 0.38);
  const chwCol = rgb(0.06, 0.48, 0.78);

  // Plate Heat Exchanger PHE-201
  const pheX = 480;
  const pheY = 360;
  page.drawRectangle({
    x: pheX,
    y: pheY,
    width: 220,
    height: 160,
    borderWidth: 3,
    borderColor: lineCol,
    color: rgb(0.94, 0.97, 1.0),
  });

  page.drawText('PLATE HEAT EXCHANGER PHE-201', {
    x: pheX + 15,
    y: pheY + 125,
    size: 11,
    font: fontSansBold,
    color: lineCol,
  });
  page.drawText('DUTY: 4500 kW CHILLING', {
    x: pheX + 35,
    y: pheY + 105,
    size: 9,
    font: fontMono,
    color: rgb(0.3, 0.4, 0.5),
  });

  // Supply and return lines
  page.drawLine({ start: { x: 120, y: pheY + 40 }, end: { x: pheX, y: pheY + 40 }, thickness: 4, color: chwCol });
  page.drawLine({ start: { x: pheX + 220, y: pheY + 40 }, end: { x: 1000, y: pheY + 40 }, thickness: 4, color: chwCol });

  page.drawText('10"-CHWS-301-CS CHILLED WATER SUPPLY TO AIR HANDLERS', {
    x: 620,
    y: pheY + 52,
    size: 9,
    font: fontMono,
    color: chwCol,
  });
}

function drawCentrifugalPump(
  page: any,
  x: number,
  y: number,
  tag: string,
  desc: string,
  lineCol: any,
  fontBold: any,
  fontMono: any,
  highlightIncident: boolean
) {
  // Pump circle casing
  page.drawCircle({
    x: x,
    y: y,
    size: 32,
    borderWidth: 3,
    borderColor: highlightIncident ? rgb(0.85, 0.2, 0.15) : lineCol,
    color: highlightIncident ? rgb(1.0, 0.94, 0.94) : rgb(0.96, 0.98, 1.0),
  });

  // Tangential discharge line going up/right
  page.drawLine({
    start: { x: x + 22, y: y + 22 },
    end: { x: x + 35, y: y },
    thickness: 3,
    color: lineCol,
  });

  // Equipment Tag text
  page.drawText(tag, {
    x: x - 22,
    y: y - 5,
    size: 11,
    font: fontBold,
    color: highlightIncident ? rgb(0.85, 0.2, 0.15) : lineCol,
  });

  page.drawText(desc, {
    x: x - 70,
    y: y - 48,
    size: 8,
    font: fontMono,
    color: rgb(0.25, 0.35, 0.45),
  });

  if (highlightIncident) {
    page.drawText('** CRITICAL RCA BOUND **', {
      x: x - 60,
      y: y + 42,
      size: 8,
      font: fontBold,
      color: rgb(0.85, 0.2, 0.15),
    });
  }
}

function drawControlValve(
  page: any,
  x: number,
  y: number,
  type: string,
  num: string,
  lineCol: any,
  fontBold: any,
  fontMono: any
) {
  // Bowtie triangles
  // Left triangle
  page.drawRectangle({
    x: x - 18,
    y: y - 10,
    width: 18,
    height: 20,
    borderWidth: 2,
    borderColor: lineCol,
    color: rgb(1, 1, 1),
  });
  // Right triangle
  page.drawRectangle({
    x: x,
    y: y - 10,
    width: 18,
    height: 20,
    borderWidth: 2,
    borderColor: lineCol,
    color: rgb(1, 1, 1),
  });

  // Actuator stem
  page.drawLine({ start: { x: x, y: y + 10 }, end: { x: x, y: y + 28 }, thickness: 2, color: lineCol });
  // Actuator top dome
  page.drawCircle({ x: x, y: y + 36, size: 10, borderWidth: 2, borderColor: lineCol, color: rgb(0.9, 0.95, 1.0) });

  // Instrument bubble
  drawInstrumentBubble(page, x, y + 68, type, num, lineCol, fontBold, fontMono);
  page.drawLine({ start: { x: x, y: y + 46 }, end: { x: x, y: y + 54 }, thickness: 1, color: lineCol });
}

function drawStrainer(page: any, x: number, y: number, tag: string, fontMono: any) {
  const lineCol = rgb(0.12, 0.22, 0.38);
  page.drawRectangle({
    x: x - 12,
    y: y - 12,
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: lineCol,
    color: rgb(1, 1, 1),
  });
  page.drawLine({ start: { x: x - 12, y: y - 12 }, end: { x: x + 12, y: y + 12 }, thickness: 1.5, color: lineCol });
  page.drawText(tag, { x: x - 20, y: y + 16, size: 7, font: fontMono, color: lineCol });
}

function drawInstrumentBubble(
  page: any,
  x: number,
  y: number,
  type: string,
  num: string,
  lineCol: any,
  fontBold: any,
  fontMono: any
) {
  page.drawCircle({
    x: x,
    y: y,
    size: 15,
    borderWidth: 1.5,
    borderColor: lineCol,
    color: rgb(1, 1, 1),
  });
  page.drawLine({
    start: { x: x - 15, y: y },
    end: { x: x + 15, y: y },
    thickness: 1,
    color: lineCol,
  });
  page.drawText(type, {
    x: x - (type.length * 3.5),
    y: y + 3,
    size: 7.5,
    font: fontBold,
    color: lineCol,
  });
  page.drawText(num, {
    x: x - (num.length * 3),
    y: y - 9,
    size: 7.5,
    font: fontMono,
    color: lineCol,
  });
}
