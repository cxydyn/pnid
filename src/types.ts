/**
 * Type definitions for Smart P&ID Viewer & RCA Investigation Dashboard
 */

export type ActionType = 'direct_link' | 'dropdown' | 'note' | 'rca';

export interface DropdownOption {
  id: string;
  label: string;
  actionType: 'page' | 'doc' | 'url' | 'note';
  targetDocId?: string;
  targetPageNum?: number;
  url?: string;
  note?: string;
}

export interface Hotspot {
  id: string;
  docId: string;
  pageNum: number;
  // Normalized 0 - 100 percentage coordinates for responsive scaling
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  equipmentTag: string;
  actionType: ActionType;
  // Action configurations
  directLink?: {
    targetDocId?: string;
    targetPageNum?: number;
    url?: string;
  };
  dropdownOptions?: DropdownOption[];
  note?: string;
  rcaId?: string;
}

export type AnnotationType = 'pen' | 'highlighter' | 'text';

export interface Point {
  x: number;
  y: number;
}

export interface Annotation {
  id: string;
  docId: string;
  pageNum: number;
  type: AnnotationType;
  points?: Point[];
  text?: string;
  x?: number;
  y?: number;
  color: string;
  strokeWidth: number;
  fontSize?: number;
}

export interface DocumentItem {
  id: string;
  name: string;
  folderId: string;
  size: number;
  pageCount: number;
  uploadDate: string;
  title: string;
  description: string;
  equipmentTag?: string;
  systemUnit?: string;
  isSample?: boolean;
  isPlotPlan?: boolean;
  rotation?: number;
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: string;
}

export type SeverityLevel = 'Critical' | 'Major' | 'Moderate' | 'Minor';

export interface AttachmentItem {
  id: string;
  name: string;
  type: string;
  caption: string;
  printSize: 'small' | 'medium' | 'large';
  storageKey: string;
  dataUrl?: string;
}

export interface FiveWhysData {
  problem: string;
  whys: [string, string, string, string, string];
  rootCauseSummary: string;
  correctiveAction: string;
  responsibleParty: string;
  targetDate: string;
}

export interface FishboneCause {
  id: string;
  text: string;
  isPrimaryRoot?: boolean;
}

export interface FishboneData {
  effect: string;
  bones: {
    manpower: FishboneCause[];
    machine: FishboneCause[];
    material: FishboneCause[];
    method: FishboneCause[];
    measurement: FishboneCause[];
    environment: FishboneCause[];
  };
}

export type FaultTreeNodeType = 'top' | 'gate' | 'basic_event' | 'intermediate';
export type GateType = 'AND' | 'OR';

export interface FaultTreeNode {
  id: string;
  parentId: string | null;
  type: FaultTreeNodeType;
  gateType?: GateType;
  label: string;
  code: string;
  probability?: number;
  x?: number;
  y?: number;
}

export interface FaultTreeData {
  topEvent: string;
  nodes: FaultTreeNode[];
}

export interface RCAInvestigation {
  id: string;
  equipmentTag: string;
  equipmentName: string;
  incidentTitle: string;
  incidentDate: string;
  plantUnit: string;
  severity: SeverityLevel;
  description: string;
  fieldFacts: string;
  immediateActions: string;
  attachments: AttachmentItem[];
  fiveWhys: FiveWhysData;
  fishbone: FishboneData;
  faultTree: FaultTreeData;
  lastUpdated: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}
