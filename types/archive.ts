export type ArchiveItemType =
  | 'golden_proportion'
  | 'optical_diagnosis'
  | 'color_analysis'
  | 'case_club';

export interface GoldenProportionData {
  imageUri: string;
  croppedImageUri?: string;
  angle: number;
  linesCoordinates: {
    vertical: number[];
    horizontal: number[];
  };
  lineAngles?: number[];
  method: string;
  segment?: 'upper' | 'lower';
  calculations: Record<string, { factMm: number; deviationPct: number; diffMm: number }>;
  aiReport?: {
    widthHeight: string;
    zenith: string;
    goldenSymmetry: string;
  };
}

export interface OpticalDiagnosisData {
  imageUri: string;
  textureNotes: string;
  cracksDetected: boolean;
  translucentZones: Array<{ x: number; y: number; label: string }>;
}

export interface ColorAnalysisData {
  imageUri: string;
  vitaShade: string;
  confidence: number;
  notes: string;
}

export interface CaseClubData {
  caseId: string;
  title: string;
  thumbnailUri?: string;
  tags: string[];
}

export type ArchiveItemData =
  | GoldenProportionData
  | OpticalDiagnosisData
  | ColorAnalysisData
  | CaseClubData;

export interface ArchiveItem {
  id: string;
  userId: string;
  patientName: string;
  type: ArchiveItemType;
  createdAt: number;
  sharedWith: string[];
  data: ArchiveItemData;
}

export const ARCHIVE_TYPE_LABELS: Record<ArchiveItemType, string> = {
  golden_proportion: 'Пропорции',
  optical_diagnosis: 'Оптика',
  color_analysis: 'Цвет',
  case_club: 'Кейс-Клуб',
};

export const ARCHIVE_TYPE_ICONS: Record<ArchiveItemType, string> = {
  golden_proportion: 'git-network-outline',
  optical_diagnosis: 'eye-outline',
  color_analysis: 'color-palette-outline',
  case_club: 'albums-outline',
};
