import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

interface Tooth {
  number: number;
  type: 'crown' | 'pontic';
}

interface ToothFormulaProps {
  selectedTeeth: Tooth[];
  setSelectedTeeth: React.Dispatch<React.SetStateAction<Tooth[]>>;
  connections: string[];
  toggleConnection: (connId: string) => void;
  toggleTooth: (num: number) => void;
  toggleToothType: (num: number) => void;
  topJawScrollRef: React.RefObject<ScrollView | null>;
  bottomJawScrollRef: React.RefObject<ScrollView | null>;
  styles: any;
}

export default function ToothFormula({
  selectedTeeth,
  setSelectedTeeth,
  connections,
  toggleConnection,
  toggleTooth,
  toggleToothType,
  topJawScrollRef,
  bottomJawScrollRef,
  styles,
}: ToothFormulaProps) {
  const clearSelection = () => {
    setSelectedTeeth([]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.cardContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text style={styles.sectionTitle}>🦷 ЗУБНАЯ ФОРМУЛА *</Text>
          <TouchableOpacity
            onPress={clearSelection}
            style={{ padding: 4, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        {/* Верхняя челюсть */}
        <View style={{ marginBottom: 20, width: '100%' }}>
          <Text style={styles.sectionLabel}>Верхняя челюсть</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 15, flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
            ref={topJawScrollRef}
          >
            <View style={{ flexDirection: 'row', paddingVertical: 10, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              {[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].map((toothNumber, idx, arr) => {
                const isSelected = selectedTeeth.some(t => t.number === toothNumber);
                const toothData = selectedTeeth.find(t => t.number === toothNumber);
                const isPontic = toothData?.type === 'pontic';
                const nextTooth = arr[idx + 1];
                const connId = `${toothNumber}-${nextTooth}`;
                const isConnected = connections.includes(connId);
                return (
                  <View key={toothNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ alignItems: 'center', width: 46, marginHorizontal: 2 }}>
                      <View style={{ height: 20, justifyContent: 'center', position: 'relative', width: '100%' }}>
                        {nextTooth && (
                          <TouchableOpacity
                            onPress={() => toggleConnection(connId)}
                            style={{
                              width: 12, height: 12, borderRadius: 6,
                              backgroundColor: isConnected ? '#FFD700' : 'rgba(255,255,255,0.15)',
                              position: 'absolute', right: -8, zIndex: 10,
                            }}
                          />
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleTooth(toothNumber)}
                        onLongPress={() => toggleToothType(toothNumber)}
                        style={[
                          styles.toothButton,
                          { width: 46, height: 44 },
                          isSelected && styles.toothSelected,
                          isPontic && styles.toothPontic,
                        ]}
                      >
                        <Text style={styles.toothText}>{toothNumber}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>

        {/* Нижняя челюсть */}
        <View style={{ marginBottom: 20, width: '100%' }}>
          <Text style={styles.sectionLabel}>Нижняя челюсть</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 15, flexGrow: 1, justifyContent: 'center', alignItems: 'center' }}
            ref={bottomJawScrollRef}
          >
            <View style={{ flexDirection: 'row', paddingVertical: 10, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
              {[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map((toothNumber, idx, arr) => {
                const isSelected = selectedTeeth.some(t => t.number === toothNumber);
                const toothData = selectedTeeth.find(t => t.number === toothNumber);
                const isPontic = toothData?.type === 'pontic';
                const nextTooth = arr[idx + 1];
                const connId = `${toothNumber}-${nextTooth}`;
                const isConnected = connections.includes(connId);
                return (
                  <View key={toothNumber} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ alignItems: 'center', width: 46, marginHorizontal: 2 }}>
                      <View style={{ height: 20, justifyContent: 'center', position: 'relative', width: '100%' }}>
                        {nextTooth && (
                          <TouchableOpacity
                            onPress={() => toggleConnection(connId)}
                            style={{
                              width: 12, height: 12, borderRadius: 6,
                              backgroundColor: isConnected ? '#FFD700' : 'rgba(255,255,255,0.15)',
                              position: 'absolute', right: -8, zIndex: 10,
                            }}
                          />
                        )}
                      </View>
                      <TouchableOpacity
                        onPress={() => toggleTooth(toothNumber)}
                        onLongPress={() => toggleToothType(toothNumber)}
                        style={[
                          styles.toothButton,
                          { width: 46, height: 44 },
                          isSelected && styles.toothSelected,
                          isPontic && styles.toothPontic,
                        ]}
                      >
                        <Text style={styles.toothText}>{toothNumber}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
