import BottomTabBar from '@/components/BottomTabBar';
import { firestore } from '@/constants/firebase';
import {
    ARCHIVE_TYPE_ICONS,
    ARCHIVE_TYPE_LABELS,
    ArchiveItem,
    ArchiveItemType,
    ColorAnalysisData,
    GoldenProportionData,
} from '@/types/archive';
import { ARCHIVE_COLLECTION, LOCAL_ARCHIVE_KEY } from '@/utils/saveToArchive';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImageManipulator from 'expo-image-manipulator';
import { router, useLocalSearchParams } from 'expo-router';
import { get, getDatabase, ref } from 'firebase/database';
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    onSnapshot,
    query,
    updateDoc,
    where
} from 'firebase/firestore';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    ImageBackground,
    LayoutAnimation,
    Modal,
    Platform,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const METHOD_LABELS: Record<string, string> = {
  preston: 'Анатомический стандарт',
  golden: 'Золотое сечение',
  red: 'Гармоничная сетка',
  'Golden Proportion': 'Золотое сечение',
  'RED Proportion': 'Гармоничная сетка',
};

const formatMethodName = (methodId?: string) => METHOD_LABELS[methodId || ''] || methodId || '—';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CATEGORY_OPTIONS: { key: ArchiveItemType; label: string }[] = [
  { key: 'golden_proportion', label: 'Пропорции' },
  { key: 'optical_diagnosis', label: 'Оптика' },
  { key: 'color_analysis', label: 'Цвет VITA' },
  { key: 'case_club', label: 'Кейс-Клуб' },
];

const CACHE_KEY_MINE = 'archive_local_cache_mine';
const CACHE_KEY_INCOMING = 'archive_local_cache_incoming';

// Email-based uid в RTDB хранится с _ вместо . (напр. doc@test_com)
const normalizeUid = (raw: string): string => raw.replace(/\./g, '_');

type FilterMode = 'mine' | 'incoming';

interface Partner {
  id: string;
  name: string;
}

// ─── Accordion card ───────────────────────────────────────────────────────────
function ArchiveCard({
  item,
  filterMode,
  onShare,
  onDelete,
  myUid,
}: {
  item: ArchiveItem;
  filterMode: FilterMode;
  onShare: (item: ArchiveItem) => void;
  onDelete: (item: ArchiveItem) => void;
  myUid: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [photoZoom, setPhotoZoom] = useState(false);

  const readBy: Record<string, boolean> = (item as any).readBy || {};
  const isUnread = filterMode === 'incoming' && myUid && !readBy[myUid];

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const opening = !expanded;
    setExpanded(opening);
    // При первом раскрытии входящей карточки пишем readBy
    if (opening && filterMode === 'incoming' && myUid && !readBy[myUid] && !item.id.startsWith('local_')) {
      updateDoc(doc(firestore, ARCHIVE_COLLECTION, item.id), { [`readBy.${myUid}`]: true })
        .catch(() => {});
    }
  };

  const icon = ARCHIVE_TYPE_ICONS[item.type] as any;
  // imageUri может лежать на топ-уровне (входящие из Firestore) или внутри data (свои)
  const rawImageUri: string =
    (item as any).imageUri ||
    (item.data as any)?.imageUri ||
    (item.data as any)?.thumbnailUri ||
    '';
  const imageUri = rawImageUri && rawImageUri.length > 10 ? rawImageUri : null;
  const patientLabel = item.patientName?.trim() || null;

  const getResultLine = (): string | null => {
    if (item.type === 'golden_proportion') {
      const d = item.data as GoldenProportionData;
      const angle = d.angle !== 0 ? ` · ${d.angle > 0 ? '+' : ''}${d.angle}°` : '';
      return `Методика: ${formatMethodName(d.method)}${angle}`;
    }
    if (item.type === 'color_analysis') {
      const d = item.data as ColorAnalysisData;
      const pct = d.confidence > 0 ? ` · Совпадение ${d.confidence}%` : '';
      return d.vitaShade ? `Оттенок: ${d.vitaShade}${pct}` : null;
    }
    return null;
  };

  const resultLine = getResultLine();
  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <View style={[cardStyles.wrap, isUnread && cardStyles.wrapUnread]}>
      {/* ── Свёрнутая часть (всегда видна) ── */}
      <TouchableOpacity style={cardStyles.header} onPress={toggle} activeOpacity={0.75}>
        <View style={cardStyles.headerLeft}>
          <View style={cardStyles.iconWrap}>
            <Ionicons name={icon} size={18} color="#f2ca50" />
          </View>
          <View style={cardStyles.headerTexts}>
            <Text style={[cardStyles.patient, !patientLabel && cardStyles.patientEmpty]} numberOfLines={1}>
              {patientLabel ?? 'Пациент: Не указан'}
            </Text>
            <View style={cardStyles.metaRow}>
              <View style={cardStyles.typePill}>
                <Text style={cardStyles.typeText}>{ARCHIVE_TYPE_LABELS[item.type]}</Text>
              </View>
              <Text style={cardStyles.date}>{formatDate(item.createdAt)}</Text>
              {filterMode === 'incoming' && (
                <View style={cardStyles.incomingPill}>
                  <Ionicons name="download-outline" size={9} color="#f2ca50" />
                  <Text style={cardStyles.incomingText}>Входящий</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        {isUnread && !expanded && (
          <View style={cardStyles.unreadDot} />
        )}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color="rgba(255,255,255,0.4)"
        />
      </TouchableOpacity>

      {/* ── Раскрытая часть (аккордеон) ── */}
      {expanded && (
        <View style={cardStyles.body}>
          <View style={cardStyles.bodyDivider} />
          <View style={cardStyles.bodyContent}>

            {/* Превью — тап открывает fullscreen */}
            {imageUri ? (
              <TouchableOpacity onPress={() => setPhotoZoom(true)} activeOpacity={0.9}>
                <Image
                  source={{ uri: imageUri }}
                  style={cardStyles.preview}
                  resizeMode="cover"
                  onError={() => console.log('IMAGE_RENDER_ERROR: length =', imageUri.length)}
                />
                <View style={cardStyles.zoomHint}>
                  <Ionicons name="expand-outline" size={14} color="rgba(255,255,255,0.8)" />
                  <Text style={cardStyles.zoomHintText}>Нажмите для увеличения</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={cardStyles.previewPlaceholder}>
                <Ionicons name="image-outline" size={36} color="rgba(138,43,226,0.6)" />
                <Text style={cardStyles.previewPlaceholderText}>
                  {filterMode === 'incoming' ? 'Фото загружается / недоступно' : 'Нет изображения'}
                </Text>
              </View>
            )}

            {/* ── Детальные данные по типу ── */}
            {item.type === 'color_analysis' && (() => {
              const d = item.data as any;
              const zones = d.zones || {};
              return (
                <>
                  {/* 1. Главный блок: оттенок + уверенность + качество */}
                  <View style={cardStyles.vitaMainBlock}>
                    <Text style={cardStyles.vitaShadeLabel}>Оттенок VITA</Text>
                    <Text style={cardStyles.vitaShadeValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                      {d.vitaShade || '—'}
                    </Text>
                    <View style={cardStyles.vitaMetaRow}>
                      <Text style={cardStyles.vitaMetaLabel}>Уверенность</Text>
                      <Text style={cardStyles.vitaMetaValue}>{d.confidence ? `${d.confidence}%` : '—'}</Text>
                    </View>
                    {d.photo_quality ? (
                      <View style={cardStyles.vitaMetaRow}>
                        <Text style={cardStyles.vitaMetaLabel}>Качество фото</Text>
                        <Text style={cardStyles.vitaMetaValue}>{d.photo_quality}</Text>
                      </View>
                    ) : null}
                  </View>

                  {/* 2–6. Описательные блоки (тёмная карточка #131e31) */}
                  {d.neck ? (
                    <View style={cardStyles.vitaDescCard}>
                      <Text style={cardStyles.vitaDescTitle}>Шейка (Пришеечная зона)</Text>
                      <Text style={cardStyles.vitaDescText}>{d.neck}</Text>
                    </View>
                  ) : null}
                  {d.notes ? (
                    <View style={cardStyles.vitaDescCard}>
                      <Text style={cardStyles.vitaDescTitle}>Тело зуба (Центральная часть)</Text>
                      <Text style={cardStyles.vitaDescText}>{d.notes}</Text>
                    </View>
                  ) : null}
                  {d.edge ? (
                    <View style={cardStyles.vitaDescCard}>
                      <Text style={cardStyles.vitaDescTitle}>Режущий край</Text>
                      <Text style={cardStyles.vitaDescText}>{d.edge}</Text>
                    </View>
                  ) : null}
                  {d.effects ? (
                    <View style={cardStyles.vitaDescCard}>
                      <Text style={cardStyles.vitaDescTitle}>Интенсивность и эффекты</Text>
                      <Text style={cardStyles.vitaDescText}>{d.effects}</Text>
                    </View>
                  ) : null}
                  {d.features ? (
                    <View style={cardStyles.vitaDescCard}>
                      <Text style={cardStyles.vitaDescTitle}>Особенности</Text>
                      <Text style={cardStyles.vitaDescText}>{d.features}</Text>
                    </View>
                  ) : null}

                  {/* 7. Субтоны (золотая рамка) */}
                  {d.secondary_subtones ? (
                    <View style={cardStyles.vitaSubtones}>
                      <Text style={cardStyles.vitaSubtonesTitle}>Сопутствующие субтоны</Text>
                      <Text style={cardStyles.vitaSubtonesText}>{d.secondary_subtones}</Text>
                    </View>
                  ) : null}

                  {/* 8. Зоны */}
                  {(zones.cervical || zones.body || zones.incisal) ? (
                    <>
                      <Text style={cardStyles.vitaSectionTitle}>Зоны</Text>
                      {[
                        { label: 'Шейка', value: zones.cervical },
                        { label: 'Тело', value: zones.body },
                        { label: 'Режущий край', value: zones.incisal },
                      ].filter(z => z.value).map((z) => (
                        <View key={z.label} style={cardStyles.vitaZoneRow}>
                          <Text style={cardStyles.vitaZoneLabel}>{z.label}</Text>
                          <Text style={cardStyles.vitaZoneValue}>{z.value}</Text>
                        </View>
                      ))}
                    </>
                  ) : null}
                </>
              );
            })()}

            {item.type === 'golden_proportion' && (() => {
              const d = item.data as any;
              const report = d.aiReport;
              return (
                <>
                  {/* Архитектурный паспорт улыбки */}
                  <View style={cardStyles.passportHeader}>
                    <Text style={cardStyles.passportTitle}>Архитектурный паспорт улыбки</Text>
                    <View style={cardStyles.passportMethodBadge}>
                      <Text style={cardStyles.passportMethodText}>
                        {formatMethodName(d.method)}
                      </Text>
                    </View>
                  </View>

                  {report ? (
                    <View style={cardStyles.passportSection}>
                      <View style={cardStyles.passportRow}>
                        <Text style={cardStyles.passportIcon}>📐</Text>
                        <View style={cardStyles.passportTextWrap}>
                          <Text style={cardStyles.passportBlockTitle}>Пропорциональный дисбаланс (Ширина/Высота)</Text>
                          <Text style={cardStyles.passportBlockText}>{report.widthHeight.replace(/^[📐📉⚖️]\s*/, '')}</Text>
                        </View>
                      </View>
                      <View style={cardStyles.passportDivider} />
                      <View style={cardStyles.passportRow}>
                        <Text style={cardStyles.passportIcon}>📉</Text>
                        <View style={cardStyles.passportTextWrap}>
                          <Text style={cardStyles.passportBlockTitle}>Десневой контур (Зениты десны)</Text>
                          <Text style={cardStyles.passportBlockText}>{report.zenith.replace(/^[📐📉⚖️]\s*/, '')}</Text>
                        </View>
                      </View>
                      <View style={cardStyles.passportDivider} />
                      <View style={cardStyles.passportRow}>
                        <Text style={cardStyles.passportIcon}>⚖️</Text>
                        <View style={cardStyles.passportTextWrap}>
                          <Text style={cardStyles.passportBlockTitle}>Симметрия по доминанте (Правило Золотого сечения)</Text>
                          <Text style={cardStyles.passportBlockText}>{report.goldenSymmetry.replace(/^[📐📉⚖️]\s*/, '')}</Text>
                        </View>
                      </View>
                    </View>
                  ) : (
                    <View style={cardStyles.passportSection}>
                      <Text style={cardStyles.passportBlockText}>AI-отчёт недоступен для этого сохранения.</Text>
                    </View>
                  )}

                  {d.angle !== 0 && d.angle !== undefined && (
                    <View style={cardStyles.detailRow}>
                      <Text style={cardStyles.detailLabel}>Наклон оси</Text>
                      <Text style={cardStyles.detailValue}>{d.angle > 0 ? '+' : ''}{d.angle}°</Text>
                    </View>
                  )}
                </>
              );
            })()}

            {item.type === 'optical_diagnosis' && (() => {
              const d = item.data as any;
              return (
                <>
                  {d.textureNotes ? (
                    <View style={cardStyles.aiBlock}>
                      <View style={cardStyles.aiBlockHeader}>
                        <Ionicons name="eye-outline" size={13} color="#a855f7" />
                        <Text style={cardStyles.aiBlockTitle}>Оптический анализ</Text>
                      </View>
                      <Text style={cardStyles.aiBlockText}>{d.textureNotes}</Text>
                    </View>
                  ) : null}
                  <View style={cardStyles.detailRow}>
                    <Text style={cardStyles.detailLabel}>Трещины</Text>
                    <Text style={[cardStyles.detailValue, { color: d.cracksDetected ? '#ff5252' : '#4caf50' }]}>
                      {d.cracksDetected ? 'Обнаружены' : 'Не обнаружены'}
                    </Text>
                  </View>
                </>
              );
            })()}

            {/* Результат (краткий) */}
            {resultLine && (
              <View style={cardStyles.resultRow}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#4caf50" />
                <Text style={cardStyles.resultText}>{resultLine}</Text>
              </View>
            )}

            {/* Кнопки действий */}
            <View style={cardStyles.actionRow}>
              <TouchableOpacity style={cardStyles.shareBtn} onPress={() => onShare(item)} activeOpacity={0.8}>
                <Ionicons name="share-social-outline" size={15} color="#031427" />
                <Text style={cardStyles.shareBtnText}>Переслать коллеге</Text>
              </TouchableOpacity>
              <TouchableOpacity style={cardStyles.deleteBtn} onPress={() => onDelete(item)} activeOpacity={0.8}>
                <Ionicons name="trash-outline" size={16} color="#ff5252" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Fullscreen Photo Modal ── */}
      <Modal visible={photoZoom} transparent animationType="fade" onRequestClose={() => setPhotoZoom(false)}>
        <View style={cardStyles.zoomOverlay}>
          <TouchableOpacity style={cardStyles.zoomClose} onPress={() => setPhotoZoom(false)} activeOpacity={0.8}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {imageUri && (
            <Image
              source={{ uri: imageUri }}
              style={cardStyles.zoomImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  wrap: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.14)',
    borderRadius: 14,
    overflow: 'hidden',
  },
  wrapUnread: {
    borderColor: 'rgba(138,43,226,0.7)',
    borderWidth: 1.5,
    backgroundColor: 'rgba(138,43,226,0.07)',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a855f7',
    marginRight: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(242,202,80,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerTexts: {
    flex: 1,
    gap: 5,
  },
  patient: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  patientEmpty: {
    color: 'rgba(255,255,255,0.3)',
    fontStyle: 'italic',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  typePill: {
    backgroundColor: 'rgba(242,202,80,0.1)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  typeText: {
    color: '#f2ca50',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  date: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
  },
  incomingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(242,202,80,0.08)',
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  incomingText: {
    color: '#f2ca50',
    fontSize: 9,
    fontWeight: '600',
  },
  bodyDivider: {
    height: 1,
    backgroundColor: 'rgba(242,202,80,0.1)',
    marginHorizontal: 14,
  },
  body: {},
  bodyContent: {
    padding: 14,
    gap: 12,
  },
  preview: {
    alignSelf: 'stretch',
    height: 160,
    borderRadius: 10,
    backgroundColor: 'rgba(10,5,30,0.6)',
  },
  previewPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    backgroundColor: 'rgba(10,5,30,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  previewPlaceholderText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    flex: 1,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#f2ca50',
    borderRadius: 10,
    paddingVertical: 10,
  },
  shareBtnText: {
    color: '#031427',
    fontSize: 13,
    fontWeight: '700',
  },
  deleteBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,82,82,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.25)',
  },
  zoomHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 4,
    opacity: 0.6,
  },
  zoomHintText: {
    color: '#fff',
    fontSize: 11,
  },
  zoomOverlay: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomImage: {
    width: '100%',
    height: '80%',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  detailLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    flex: 1,
  },
  detailValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  detailShadeBox: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 2,
  },
  detailShadeLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  detailShadeValue: {
    color: '#f2ca50',
    fontSize: 22,
    fontWeight: '700',
  },
  detailConfidence: {
    color: '#4caf50',
    fontSize: 12,
    fontWeight: '600',
  },
  zonesBlock: {
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.25)',
    borderRadius: 10,
    overflow: 'hidden',
    marginTop: 4,
  },
  zonesTitle: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  zoneLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    flex: 1,
  },
  zoneValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    flex: 1,
  },
  notesBlock: {
    paddingVertical: 8,
    gap: 4,
  },
  notesLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  notesText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 19,
  },
  aiBlock: {
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.3)',
    borderRadius: 10,
    padding: 12,
    backgroundColor: 'rgba(138,43,226,0.05)',
    gap: 6,
  },
  aiBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiBlockTitle: {
    color: '#a855f7',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  aiBlockText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 20,
  },
  vitaMainBlock: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  vitaShadeLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  vitaShadeValue: {
    color: '#f2ca50',
    fontSize: 44,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 1,
  },
  vitaMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  vitaMetaLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  vitaMetaValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  vitaDescCard: {
    backgroundColor: '#131e31',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  vitaDescTitle: {
    fontWeight: '700',
    fontSize: 13,
    color: '#f2ca50',
    marginBottom: 6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  vitaDescText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 22,
  },
  vitaSubtones: {
    backgroundColor: 'rgba(242,202,80,0.1)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.4)',
  },
  vitaSubtonesTitle: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  vitaSubtonesText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    lineHeight: 20,
  },
  vitaSectionTitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 2,
  },
  vitaZoneRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  vitaZoneLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 3,
  },
  vitaZoneValue: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  passportSection: {
    marginBottom: 4,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: 10,
  },
  passportHeader: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  passportTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  passportMethodBadge: {
    alignSelf: 'center',
    maxWidth: '90%',
    flexWrap: 'wrap',
    backgroundColor: 'rgba(242,202,80,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  passportMethodText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '600',
    flexWrap: 'wrap',
    textAlign: 'center',
  },
  passportRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  passportIcon: {
    fontSize: 22,
    lineHeight: 28,
  },
  passportTextWrap: {
    flex: 1,
    gap: 4,
  },
  passportBlockTitle: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    lineHeight: 18,
  },
  passportBlockText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    lineHeight: 20,
  },
  passportDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function CategoryDropdown({
  value,
  onChange,
  unreadsByType,
}: {
  value: ArchiveItemType;
  onChange: (v: ArchiveItemType) => void;
  unreadsByType?: Partial<Record<ArchiveItemType, number>>;
}) {
  const [open, setOpen] = useState(false);
  const current = CATEGORY_OPTIONS.find((o) => o.key === value)!;
  const triggerUnread = unreadsByType?.[value] ?? 0;

  return (
    <View style={ddStyles.wrap}>
      <TouchableOpacity style={ddStyles.trigger} onPress={() => setOpen((v) => !v)} activeOpacity={0.8}>
        <Ionicons name={ARCHIVE_TYPE_ICONS[value] as any} size={16} color="#f2ca50" />
        <Text style={ddStyles.triggerText}>{current.label}</Text>
        {triggerUnread > 0 && (
          <View style={ddStyles.badge}><Text style={ddStyles.badgeText}>{triggerUnread}</Text></View>
        )}
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.5)" />
      </TouchableOpacity>
      {open && (
        <View style={ddStyles.menu}>
          {CATEGORY_OPTIONS.map((opt) => {
            const cnt = unreadsByType?.[opt.key] ?? 0;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[ddStyles.menuItem, opt.key === value && ddStyles.menuItemActive]}
                onPress={() => { onChange(opt.key); setOpen(false); }}
              >
                <Ionicons
                  name={ARCHIVE_TYPE_ICONS[opt.key] as any}
                  size={14}
                  color={opt.key === value ? '#f2ca50' : 'rgba(255,255,255,0.5)'}
                />
                <Text style={[ddStyles.menuItemText, opt.key === value && ddStyles.menuItemTextActive]}>
                  {opt.label}
                </Text>
                {cnt > 0 && (
                  <View style={ddStyles.badge}><Text style={ddStyles.badgeText}>{cnt}</Text></View>
                )}
                {opt.key === value && cnt === 0 && <Ionicons name="checkmark" size={14} color="#f2ca50" />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const ddStyles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginBottom: 10,
    zIndex: 10,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(242,202,80,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.25)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  triggerText: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  menu: {
    marginTop: 4,
    backgroundColor: '#0d1624',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  menuItemActive: {
    backgroundColor: 'rgba(242,202,80,0.08)',
  },
  menuItemText: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
  },
  menuItemTextActive: {
    color: '#f2ca50',
    fontWeight: '700',
  },
  badge: {
    backgroundColor: '#a855f7',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 'auto',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function GlobalArchiveScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: ArchiveItemType | 'incoming' }>();

  const [activeTab, setActiveTab] = useState<ArchiveItemType>(
    (params.tab && params.tab !== 'incoming') ? params.tab : 'golden_proportion'
  );
  const [filterMode, setFilterMode] = useState<FilterMode>(
    params.tab === 'incoming' ? 'incoming' : 'mine'
  );
  const [allItems, setAllItems] = useState<ArchiveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  // authUid — единственный источник истины для uid подписки
  const [authUid, setAuthUid] = useState<string | null>(null);

  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [shareSuccessVisible, setShareSuccessVisible] = useState(false);
  const [shareTarget, setShareTarget] = useState<ArchiveItem | null>(null);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [sharingId, setSharingId] = useState<string | null>(null);

  const unsubRef = useRef<(() => void) | null>(null);
  const uidRef = useRef<string | null>(null);

  // Фильтруем и дедуплицируем по createdAt — убираем дубли (local_ + серверная копия)
  const items = (() => {
    const filtered = allItems.filter((it) => it.type === activeTab);
    const seen = new Set<number>();
    return filtered.filter((it) => {
      if (seen.has(it.createdAt)) return false;
      seen.add(it.createdAt);
      return true;
    });
  })();

  // Читаем текущего пользователя один раз при монтировании
  useEffect(() => {
    AsyncStorage.getItem('user').then((raw) => {
      if (!raw) return;
      const u = JSON.parse(raw);
      const rawUid: string = u.id || u.uid || u.email || '';
      const uid = normalizeUid(rawUid);
      console.log('AUTH_UID_DEBUG: rawUid =', rawUid, '| normalizedUid =', uid);
      if (uidRef.current === uid) return;
      uidRef.current = uid;
      setCurrentUser(u);
      setAuthUid(uid);
    });
  }, []);

  // Подписка только по authUid — никакой другой стейт не может её триггернуть
  useEffect(() => {
    if (!authUid) return;
    setAllItems([]);
    subscribeItems(authUid, filterMode);
    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
    };
  }, [authUid, filterMode]);

  // Отдельная подписка для бейджа "Входящие" и счётчиков по категориям
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadsByType, setUnreadsByType] = useState<Partial<Record<ArchiveItemType, number>>>({});
  useEffect(() => {
    if (!authUid) return;
    const q = query(
      collection(firestore, ARCHIVE_COLLECTION),
      where('sharedWith', 'array-contains', authUid),
    );
    const unsub = onSnapshot(q, (snap) => {
      const byType: Partial<Record<ArchiveItemType, number>> = {};
      let total = 0;
      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.userId === authUid) return;
        const readBy: Record<string, boolean> = data.readBy || {};
        if (!readBy[authUid]) {
          total++;
          const t = data.type as ArchiveItemType;
          byType[t] = (byType[t] ?? 0) + 1;
        }
      });
      setUnreadCount(total);
      setUnreadsByType(byType);
    }, () => {});
    return () => unsub();
  }, [authUid]);

  const persistCache = (data: ArchiveItem[]) => {
    const key = filterMode === 'mine' ? CACHE_KEY_MINE : CACHE_KEY_INCOMING;
    AsyncStorage.setItem(key, JSON.stringify(data)).catch(() => {});
  };

  const loadFromCache = async (): Promise<ArchiveItem[]> => {
    try {
      // Для режима 'mine' объединяем два источника:
      // 1. Локальный резерв saveToArchive (LOCAL_ARCHIVE_KEY) — самый надёжный
      // 2. Кэш предыдущего onSnapshot
      if (filterMode === 'mine') {
        const [localRaw, cacheRaw] = await Promise.all([
          AsyncStorage.getItem(LOCAL_ARCHIVE_KEY),
          AsyncStorage.getItem(CACHE_KEY_MINE),
        ]);
        const local: ArchiveItem[] = localRaw ? JSON.parse(localRaw) : [];
        const cached: ArchiveItem[] = cacheRaw ? JSON.parse(cacheRaw) : [];
        // Объединяем, убираем дубли по id
        const seen = new Set<string>();
        const merged: ArchiveItem[] = [];
        for (const it of [...local, ...cached]) {
          if (!seen.has(it.id)) { seen.add(it.id); merged.push(it); }
        }
        merged.sort((a, b) => b.createdAt - a.createdAt);
        return merged;
      } else {
        const raw = await AsyncStorage.getItem(CACHE_KEY_INCOMING);
        return raw ? JSON.parse(raw) : [];
      }
    } catch (e) {
      return [];
    }
  };

  const subscribeItems = (uid: string, mode: FilterMode) => {
    // Жёсткая защита: пропускаем только собственный uid
    if (uidRef.current && uid !== uidRef.current) {
      console.warn('ARCHIVE_DEBUG: ЗАБЛОКИРОВАНА попытка чужой подписки для UID:', uid, 'ждалось:', uidRef.current);
      return;
    }
    unsubRef.current?.();
    setLoading(true);

    // Сначала показываем кэш — данные видны мгновенно
    loadFromCache().then((cached) => {
      if (cached.length > 0) {
        setAllItems(cached);
        setLoading(false);
      }
    });

    const col = collection(firestore, ARCHIVE_COLLECTION);
    console.log('SUBSCRIBE_DEBUG: mode =', mode, '| uid =', uid);
    const q = mode === 'mine'
      ? query(col, where('userId', '==', uid))
      : query(col, where('sharedWith', 'array-contains', uid));

    unsubRef.current = onSnapshot(
      q,
      (snap) => {
        if (mode === 'incoming') {
          console.log('SUBSCRIBE_INCOMING: snap.size =', snap.size, '| uid фильтра =', uid);
          snap.docs.forEach((d) => console.log('SUBSCRIBE_INCOMING doc:', d.id, 'sharedWith =', d.data().sharedWith));
        }
        const data = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as ArchiveItem))
          // Владелец не видит мягко удалённые; коллеги видят всегда
          .filter((it) => !(mode === 'mine' && (it as any).deletedByOwner === true))
          // Входящие: убираем документы где userId === uid (свои анализы)
          .filter((it) => !(mode === 'incoming' && it.userId === uid));
        data.sort((a, b) => b.createdAt - a.createdAt);
        if (data.length > 0) {
          setAllItems(data);
          persistCache(data);
        } else if (mode === 'mine') {
          loadFromCache().then((cached) => {
            if (cached.length > 0) {
              setAllItems(cached);
            } else {
              setAllItems([]);
            }
          });
        } else {
          setAllItems([]);
        }
        setLoading(false);
        setRefreshing(false);
      },
      (err) => {
        console.error('ARCHIVE_FETCH_ERROR:', err);
        setLoading(false);
        setRefreshing(false);
      },
    );
  };

  const onRefresh = useCallback(() => {
    if (!authUid) return;
    setRefreshing(true);
    subscribeItems(authUid, filterMode);
  }, [authUid, filterMode]);

  const loadPartners = async () => {
    if (!currentUser) return;
    const uid: string = normalizeUid(currentUser.id || currentUser.uid || currentUser.email || '');
    const db = getDatabase();
    const snap = await get(ref(db, 'partnerships'));
    if (!snap.exists()) return;
    const list: Partner[] = [];
    const seen = new Set<string>();
    Object.values(snap.val()).forEach((p: any) => {
      if (!p) return;
      if (currentUser.role === 'doctor' && p.doctorUid === uid && p.technicianUid && !seen.has(p.technicianUid)) {
        seen.add(p.technicianUid);
        list.push({ id: p.technicianUid, name: p.technicianName });
      } else if (currentUser.role === 'technician' && p.technicianUid === uid && p.doctorUid && !seen.has(p.doctorUid)) {
        seen.add(p.doctorUid);
        list.push({ id: p.doctorUid, name: p.doctorName });
      }
    });
    setPartners(list);
  };

  const openShareModal = (item: ArchiveItem) => {
    setShareTarget(item);
    setShareModalVisible(true);
    loadPartners();
  };

  const shareWithColleague = (colleagueId: string) => {
    if (!shareTarget) return;
    const localId = shareTarget.id;
    const existing = Array.isArray(shareTarget.sharedWith) ? shareTarget.sharedWith : [];
    const newSharedWith = existing.includes(colleagueId) ? existing : [...existing, colleagueId];
    const patchedTarget: ArchiveItem = { ...shareTarget, sharedWith: newSharedWith };

    console.log('SHARE_TRACE [1]: Старт. itemId =', localId, 'colleagueId =', colleagueId);

    // ── Шаг 1: мгновенно обновляем UI ────────────────────────────────────
    setShareTarget(patchedTarget);
    setAllItems((prev) =>
      prev.map((it) => (it.id === localId ? { ...it, sharedWith: newSharedWith } : it)),
    );
    setSharingId(null);
    setShareModalVisible(false);
    setShareSuccessVisible(true);

    // ── Шаг 2: фоновый AsyncStorage патч ─────────────────────────────────
    const patchCache = async (key: string) => {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) return;
        const list: ArchiveItem[] = JSON.parse(raw);
        const updated = list.map((it) =>
          it.id === localId ? { ...it, sharedWith: newSharedWith } : it,
        );
        await AsyncStorage.setItem(key, JSON.stringify(updated));
      } catch (_) {}
    };
    patchCache(LOCAL_ARCHIVE_KEY);
    patchCache(CACHE_KEY_MINE);

    // ── Шаг 3: фоновый Firestore + base64 сжатие (inline, без await) ────────
    if (localId.startsWith('local_')) {
      const cleanData = { ...(patchedTarget.data as any) };
      // Берём localImageUri ДО очистки
      const localImageUri: string = cleanData.imageUri || cleanData.croppedImageUri || '';
      const base64Fields = ['imageUri', 'croppedImageUri', 'image', 'photo', 'base64', 'uri', 'croppedImage'];
      base64Fields.forEach((f) => { if (cleanData[f]) cleanData[f] = ''; });

      const firestorePayload: any = {
        userId: patchedTarget.userId,
        patientName: patchedTarget.patientName,
        type: patchedTarget.type,
        createdAt: patchedTarget.createdAt,
        data: cleanData,
        sharedWith: newSharedWith,
        status: 'unread',
        imageUri: '',
      };

      // Сжимаем фото до 250px и пишем base64 прямо в Firestore (Storage не нужен)
      const uploadImageIfNeeded = async (docId: string) => {
        if (!localImageUri || localImageUri.startsWith('http') || localImageUri.startsWith('data:')) return;
        try {
          console.log('BASE64_PROCESSING: Начинаем сжатие фото зуба...');
          const compressed = await ImageManipulator.manipulateAsync(
            localImageUri,
            [{ resize: { width: 250 } }],
            { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
          );
          if (!compressed.base64) throw new Error('base64 пустой после сжатия');
          const dataUri = `data:image/jpeg;base64,${compressed.base64}`;
          console.log('BASE64_SUCCESS: Картинка сжата! Длина строки:', dataUri.length, '| ~', Math.round(dataUri.length * 0.75 / 1024), 'KB');
          await updateDoc(doc(firestore, ARCHIVE_COLLECTION, docId), { imageUri: dataUri });
        } catch (err) {
          console.log('BASE64_ERROR:', (err as any)?.message ?? err);
        }
      };

      console.log('BACKGROUND_SYNC: sharedWith =', JSON.stringify(firestorePayload.sharedWith), '| userId =', firestorePayload.userId, '| размер =', JSON.stringify(firestorePayload).length);
      addDoc(collection(firestore, ARCHIVE_COLLECTION), firestorePayload)
        .then((docRef) => {
          console.log('🎉🎉🎉 FIRESTORE_LIVE_SUCCESS: Документ создан! ID:', docRef.id);
          uploadImageIfNeeded(docRef.id);
          // Заменяем local_ id на реальный в обоих кэшах
          const replaceId = async (key: string) => {
            try {
              const raw = await AsyncStorage.getItem(key);
              if (!raw) return;
              const list: ArchiveItem[] = JSON.parse(raw);
              const updated = list.map((it) =>
                it.id === localId ? { ...it, id: docRef.id } : it,
              );
              await AsyncStorage.setItem(key, JSON.stringify(updated));
            } catch (_) {}
          };
          replaceId(LOCAL_ARCHIVE_KEY);
          replaceId(CACHE_KEY_MINE);
          setAllItems((prev) =>
            prev.map((it) => (it.id === localId ? { ...it, id: docRef.id } : it)),
          );
        })
        .catch((err) => console.log('BACKGROUND_SYNC_CRITICAL_ERROR:', err?.message ?? err));
    } else {
      // Реальный Firestore id — updateDoc с sharedWith + base64 imageUri
      console.log('SHARE_TRACE [2]: Фоновый updateDoc для id =', localId);
      (async () => {
        const existingImageUri: string =
          (patchedTarget as any).imageUri ||
          (patchedTarget.data as any)?.imageUri ||
          (patchedTarget.data as any)?.croppedImageUri ||
          '';
        let finalImageUri = existingImageUri;

        if (existingImageUri && (existingImageUri.startsWith('file://') || existingImageUri.startsWith('content://'))) {
          try {
            console.log('SHARE_TRACE [2.5]: Сжимаем фото перед updateDoc...');
            const compressed = await ImageManipulator.manipulateAsync(
              existingImageUri,
              [{ resize: { width: 250 } }],
              { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
            );
            if (compressed.base64) {
              finalImageUri = `data:image/jpeg;base64,${compressed.base64}`;
              console.log('SHARE_TRACE [2.5 OK]: base64 готов, длина =', finalImageUri.length);
            }
          } catch (e) {
            console.log('SHARE_TRACE [2.5 ERROR]:', (e as any)?.message ?? e);
            finalImageUri = '';
          }
        }

        const patch: any = { sharedWith: arrayUnion(colleagueId) };
        if (finalImageUri && finalImageUri.startsWith('data:')) patch.imageUri = finalImageUri;

        updateDoc(doc(firestore, ARCHIVE_COLLECTION, localId), patch)
          .then(() => console.log('SHARE_TRACE [OK]: updateDoc выполнен, imageUri length =', finalImageUri.length))
          .catch((err) => console.log('SHARE_TRACE [ERROR]:', err?.message ?? err));
      })();
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<ArchiveItem | null>(null);

  const confirmDelete = async (item: ArchiveItem) => {
            // 1. Мгновенно убираем из стейта
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setAllItems((prev) => prev.filter((it) => it.id !== item.id));

            // 2. Удаляем из обоих локальных кэшей
            try {
              const removeFromCache = async (key: string) => {
                const raw = await AsyncStorage.getItem(key);
                if (!raw) return;
                const list: ArchiveItem[] = JSON.parse(raw);
                await AsyncStorage.setItem(key, JSON.stringify(list.filter((it) => it.id !== item.id)));
              };
              await Promise.all([
                removeFromCache(LOCAL_ARCHIVE_KEY),
                removeFromCache(CACHE_KEY_MINE),
                removeFromCache(CACHE_KEY_INCOMING),
              ]);
            } catch (e) {
              console.error('[deleteArchiveItem] cache error', e);
            }

            // 3. Мягкое удаление в Firestore — документ не стирается у коллеги
            if (!item.id.startsWith('local_')) {
              const myUid = uidRef.current ?? '';
              const isOwner = item.userId === myUid;
              if (isOwner) {
                // Владелец помечает как удалённый — коллеги продолжают видеть
                updateDoc(doc(firestore, ARCHIVE_COLLECTION, item.id), { deletedByOwner: true })
                  .catch((err) => console.error('[deleteArchiveItem] owner soft-delete error', err));
              } else {
                // Коллега убирает себя из sharedWith — только у него исчезает
                updateDoc(doc(firestore, ARCHIVE_COLLECTION, item.id), { sharedWith: arrayRemove(myUid) })
                  .catch((err) => console.error('[deleteArchiveItem] arrayRemove error', err));
              }
            }
  };

  const deleteArchiveItem = (item: ArchiveItem) => setDeleteTarget(item);

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container} pointerEvents="box-none">
        <View style={[styles.inner, { paddingTop: insets.top }]}>

          {/* Хедер */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color="#f2ca50" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Глобальный архив</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Мои / Входящие */}
          <View style={styles.filterRow}>
            {(['mine', 'incoming'] as FilterMode[]).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.filterBtn, filterMode === m && styles.filterBtnActive]}
                onPress={() => setFilterMode(m)}
              >
                <Ionicons
                  name={m === 'mine' ? 'person-outline' : 'download-outline'}
                  size={13}
                  color={filterMode === m ? '#031427' : 'rgba(242,202,80,0.7)'}
                />
                <Text style={[styles.filterBtnText, filterMode === m && styles.filterBtnTextActive]}>
                  {m === 'mine' ? 'Мои анализы' : 'Входящие'}
                </Text>
                {m === 'incoming' && unreadCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Dropdown категории */}
          <CategoryDropdown
            value={activeTab}
            onChange={setActiveTab}
            unreadsByType={filterMode === 'incoming' ? unreadsByType : undefined}
          />

          {/* Список */}
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#f2ca50" size="large" />
            </View>
          ) : items.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="file-tray-outline" size={52} color="rgba(242,202,80,0.2)" />
              <Text style={styles.emptyText}>
                {filterMode === 'mine' ? 'Нет сохранённых анализов' : 'Нет входящих анализов'}
              </Text>
              <Text style={styles.emptySubText}>
                {filterMode === 'mine'
                  ? 'Результаты ИИ-анализов сохраняются автоматически'
                  : 'Коллеги могут отправить вам анализы через кнопку «Поделиться»'}
              </Text>
            </View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={items}
              keyExtractor={(it) => it.id}
              renderItem={({ item }) => (
                <ArchiveCard item={item} filterMode={filterMode} onShare={openShareModal} onDelete={deleteArchiveItem} myUid={authUid ?? ''} />
              )}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f2ca50" />
              }
            />
          )}
        </View>
      </View>

      {/* ── Cosmic Delete Confirm Modal ──────────────────────────────────── */}
      <Modal
        visible={!!deleteTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteTarget(null)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.deleteBox}>
            <View style={styles.deleteIconWrap}>
              <Ionicons name="trash-outline" size={36} color="#ff5252" />
            </View>
            <Text style={styles.deleteTitle}>Удалить анализ?</Text>
            <Text style={styles.deleteSub}>
              {deleteTarget && deleteTarget.userId !== (uidRef.current ?? '')
                ? 'Анализ исчезнет из ваших Входящих. Владелец по-прежнему увидит его у себя.'
                : 'Вы уверены? Это действие нельзя отменить.'}
            </Text>
            <View style={styles.deleteBtns}>
              <TouchableOpacity
                style={styles.deleteCancelBtn}
                onPress={() => setDeleteTarget(null)}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteCancelText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteConfirmBtn}
                onPress={() => { if (deleteTarget) { confirmDelete(deleteTarget); setDeleteTarget(null); } }}
                activeOpacity={0.8}
              >
                <Text style={styles.deleteConfirmText}>Удалить</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Cosmic Success Modal ─────────────────────────────────────────── */}
      <Modal
        visible={shareSuccessVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setShareSuccessVisible(false)}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successBox}>
            <View style={styles.successIconWrap}>
              <Ionicons name="checkmark-circle" size={56} color="#22c55e" />
            </View>
            <Text style={styles.successTitle}>Успешно отправлено!</Text>
            <Text style={styles.successSub}>Коллега уже получил уведомление</Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => setShareSuccessVisible(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.successBtnText}>Отлично!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Модалка «Поделиться» */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.shareModal}>
            <View style={styles.shareModalHeader}>
              <Ionicons name="share-social-outline" size={22} color="#f2ca50" />
              <Text style={styles.shareModalTitle}>Переслать коллеге</Text>
              <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            {shareTarget && (
              <Text style={styles.shareModalSub}>
                Анализ: <Text style={{ color: '#f2ca50' }}>{shareTarget.patientName || 'без имени'}</Text>
              </Text>
            )}
            {partners.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
                <Text style={styles.emptyText}>Нет связанных партнёров</Text>
                <Text style={styles.emptySubText}>Подключите коллег через раздел «Наряды»</Text>
              </View>
            ) : (
              partners.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.partnerRow}
                  onPress={() => shareWithColleague(p.id)}
                >
                  <View style={styles.partnerAvatar}>
                    <Text style={styles.partnerAvatarText}>{p.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.partnerName}>{p.name}</Text>
                  <Ionicons name="send-outline" size={18} color="#f2ca50" />
                </TouchableOpacity>
              ))
            )}
          </View>
        </View>
      </Modal>

      <BottomTabBar />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,202,80,0.15)',
    backgroundColor: 'rgba(3,20,39,0.6)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.25)',
    backgroundColor: 'rgba(242,202,80,0.05)',
  },
  filterBtnActive: {
    backgroundColor: '#f2ca50',
    borderColor: '#f2ca50',
  },
  filterBtnText: {
    color: 'rgba(242,202,80,0.7)',
    fontSize: 12,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: '#031427',
  },
  filterBadge: {
    backgroundColor: '#a855f7',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginLeft: 4,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 160,
    gap: 10,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptySubText: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  shareModal: {
    backgroundColor: '#0d1624',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    borderColor: 'rgba(242,202,80,0.2)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 12,
  },
  shareModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareModalTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginLeft: 10,
  },
  shareModalSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
  },
  partnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  partnerRowDone: {
    opacity: 0.6,
  },
  partnerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(242,202,80,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
  },
  partnerAvatarText: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '700',
  },
  partnerName: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  successOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBox: {
    backgroundColor: '#0B0B1E',
    borderWidth: 1,
    borderColor: 'rgba(138,43,226,0.6)',
    borderRadius: 20,
    paddingHorizontal: 32,
    paddingVertical: 36,
    alignItems: 'center',
    width: 300,
    gap: 12,
  },
  successIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(34,197,94,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  successTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  successSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
  },
  successBtn: {
    marginTop: 8,
    backgroundColor: '#7c3aed',
    borderRadius: 14,
    paddingHorizontal: 40,
    paddingVertical: 13,
  },
  successBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  deleteBox: {
    backgroundColor: '#0B0B1E',
    borderWidth: 1,
    borderColor: 'rgba(255,82,82,0.35)',
    borderRadius: 20,
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: 'center',
    width: 300,
    gap: 10,
  },
  deleteIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,82,82,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  deleteTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  deleteSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  deleteBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  deleteCancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteCancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteConfirmBtn: {
    flex: 1,
    backgroundColor: '#ff3b30',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteConfirmText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});
