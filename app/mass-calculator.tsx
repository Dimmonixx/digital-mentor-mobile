import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VITA_COLORS = [
  'BL1', 'BL2', 'BL3', 'BL4',
  'A1', 'B1', 'A2', 'B2',
  'C1', 'D2', 'A3', 'D3',
  'B3', 'A3.5', 'C2', 'D4',
  'B4', 'A4', 'C3', 'C4'
];

const COMMON_MIXES = [
  'A3-A3.5', 'A3.5-A4', 'A4-B4',
  'BL4-A1', 'A1-A2', 'A2-A3',
  'B2-B3', 'C2-C3'
];

interface RecipeItem {
  layer: string;
  icon: string;
  material: string;
  parts: number;
}

export default function MassCalculatorScreen() {
  const insets = useSafeAreaInsets();
  const { autoShade } = useLocalSearchParams<{ autoShade?: string }>();
  const [selectedBrand, setSelectedBrand] = useState<'emax' | 'noritake'>('emax');
  const [selectedColor, setSelectedColor] = useState('A3.5');
  const [quantity, setQuantity] = useState(1);
  const [showMixes, setShowMixes] = useState(false);

  useEffect(() => {
    if (autoShade) {
      setSelectedColor(autoShade);
    }
  }, [autoShade]);

  const calculateRecipe = (color: string, brand: 'emax' | 'noritake', units: number): RecipeItem[] => {
    const recipe: RecipeItem[] = [];

    if (brand === 'emax') {
      // Ivoclar IPS e.max layers - ultra-compact professional format
      
      // Cervical: Professional mixing formula
      if (units === 1) {
        // Single crown - percentage format
        recipe.push({
          layer: 'Cervical',
          icon: '🛑',
          material: `DA${color} 50% + CV1 40% + ODA${color} 10%`,
          parts: 1
        });
      } else {
        // Multiple crowns - parts format
        const baseParts = units;
        recipe.push({
          layer: 'Cervical',
          icon: '�',
          material: `DA${color} (${baseParts} ч.) + CV1 (${(baseParts * 0.8).toFixed(1)} ч.) + ODA${color} (${(baseParts * 0.2).toFixed(1)} ч.)`,
          parts: baseParts
        });
      }

      // Opaque Body: Ultra-compact
      recipe.push({
        layer: 'Opaque Body',
        icon: '🟡',
        material: `DD${color}`,
        parts: 1.5 * units
      });

      // Body: Ultra-compact
      recipe.push({
        layer: 'Body',
        icon: '🟠',
        material: color,
        parts: 2.5 * units
      });

      // Enamel: Ultra-compact
      recipe.push({
        layer: 'Enamel',
        icon: '🔵',
        material: 'E1',
        parts: 1.5 * units
      });

      // Luster: Ultra-compact
      recipe.push({
        layer: 'Luster',
        icon: '⚪',
        material: 'Transpa',
        parts: 1 * units
      });

    } else {
      // Noritake EX-3 layers - ultra-compact professional format
      
      // Cervical: Professional mixing formula
      if (units === 1) {
        // Single crown - percentage format
        recipe.push({
          layer: 'Cervical',
          icon: '🛑',
          material: `${color}B 50% + CV1 40% + OB-${color} 10%`,
          parts: 1
        });
      } else {
        // Multiple crowns - parts format
        const baseParts = units;
        recipe.push({
          layer: 'Cervical',
          icon: '�',
          material: `${color}B (${baseParts} ч.) + CV1 (${(baseParts * 0.8).toFixed(1)} ч.) + OB-${color} (${(baseParts * 0.2).toFixed(1)} ч.)`,
          parts: baseParts
        });
      }

      // Opaque Body: Ultra-compact
      recipe.push({
        layer: 'Opaque Body',
        icon: '🟡',
        material: `OB-${color}`,
        parts: 1.5 * units
      });

      // Body: Ultra-compact
      recipe.push({
        layer: 'Body',
        icon: '🟠',
        material: `${color}B`,
        parts: 2.5 * units
      });

      // Enamel: Ultra-compact
      recipe.push({
        layer: 'Enamel',
        icon: '🔵',
        material: 'E2',
        parts: 1.5 * units
      });

      // Luster: Ultra-compact
      recipe.push({
        layer: 'Luster',
        icon: '⚪',
        material: 'LT1',
        parts: 1 * units
      });
    }

    return recipe;
  };

  const recipe = calculateRecipe(selectedColor, selectedBrand, quantity);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Калькулятор керамики</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Brand Switcher */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Бренд керамики</Text>
          <View style={styles.switcher}>
            <TouchableOpacity
              style={[
                styles.switcherButton,
                selectedBrand === 'emax' && styles.switcherButtonActive
              ]}
              onPress={() => setSelectedBrand('emax')}
            >
              <Text style={[
                styles.switcherButtonText,
                selectedBrand === 'emax' && styles.switcherButtonTextActive
              ]}>
                Ivoclar IPS e.max
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.switcherButton,
                selectedBrand === 'noritake' && styles.switcherButtonActive
              ]}
              onPress={() => setSelectedBrand('noritake')}
            >
              <Text style={[
                styles.switcherButtonText,
                selectedBrand === 'noritake' && styles.switcherButtonTextActive
              ]}>
                Kuraray Noritake
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Color Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Выбор оттенка VITA</Text>
          
          <TouchableOpacity
            style={styles.mixToggle}
            onPress={() => setShowMixes(!showMixes)}
          >
            <Text style={styles.mixToggleText}>
              {showMixes ? 'Показать основные цвета' : 'Показать смешанные оттенки'}
            </Text>
          </TouchableOpacity>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.colorScroll}
            contentContainerStyle={{ paddingHorizontal: 16 }}
          >
            {(showMixes ? COMMON_MIXES : VITA_COLORS).map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorChip,
                  selectedColor === color && styles.colorChipActive
                ]}
                onPress={() => setSelectedColor(color)}
              >
                <Text style={[
                  styles.colorChipText,
                  selectedColor === color && styles.colorChipTextActive
                ]}>
                  {color}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.selectedColorDisplay}>
            <Text style={styles.selectedColorLabel}>Выбранный оттенок:</Text>
            <Text style={styles.selectedColorValue}>{selectedColor}</Text>
          </View>
        </View>

        {/* Quantity Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Количество единиц</Text>
          <View style={styles.quantitySelector}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(Math.max(1, quantity - 1))}
            >
              <Ionicons name="remove" size={20} color="#f2ca50" />
            </TouchableOpacity>
            <View style={styles.quantityDisplay}>
              <Text style={styles.quantityText}>{quantity}</Text>
              <Text style={styles.quantityLabel}>коронок</Text>
            </View>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => setQuantity(quantity + 1)}
            >
              <Ionicons name="add" size={20} color="#f2ca50" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Recipe Result */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Рецепт замеса</Text>
          <View style={styles.recipeCard}>
            {recipe.map((item, index) => (
              <View key={index} style={styles.recipeItem}>
                <Text style={styles.recipeIcon}>{item.icon}</Text>
                <Text style={styles.recipeCompact}>
                  {item.layer}: {item.material}
                </Text>
                <Text style={styles.recipeParts}>
                  {item.parts} {item.parts === 1 ? 'часть' : item.parts < 5 ? 'части' : 'частей'}
                </Text>
              </View>
            ))}
          </View>
          
          <View style={styles.totalInfo}>
            <Text style={styles.totalText}>
              Пропорции рассчитаны на слой нанесения для {quantity} {quantity === 1 ? 'коронки' : 'коронок'}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#031427',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(242,202,80,0.2)',
  },
  headerTitle: {
    color: '#f2ca50',
    fontSize: 18,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
  },
  switcherButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  switcherButtonActive: {
    backgroundColor: '#f2ca50',
  },
  switcherButtonText: {
    color: '#f2ca50',
    fontSize: 13,
    fontWeight: '600',
  },
  switcherButtonTextActive: {
    color: '#031427',
  },
  mixToggle: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  mixToggleText: {
    color: 'rgba(242,202,80,0.7)',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  colorScroll: {
    marginBottom: 16,
  },
  colorChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(242,202,80,0.3)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  colorChipActive: {
    backgroundColor: '#f2ca50',
    borderColor: '#f2ca50',
  },
  colorChipText: {
    color: '#f2ca50',
    fontSize: 12,
    fontWeight: '500',
  },
  colorChipTextActive: {
    color: '#031427',
  },
  selectedColorDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
  },
  selectedColorLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  selectedColorValue: {
    color: '#f2ca50',
    fontSize: 16,
    fontWeight: '600',
  },
  quantitySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
  },
  quantityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(242,202,80,0.1)',
    borderWidth: 1,
    borderColor: '#f2ca50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityDisplay: {
    alignItems: 'center',
    marginHorizontal: 24,
  },
  quantityText: {
    color: '#f2ca50',
    fontSize: 24,
    fontWeight: '600',
  },
  quantityLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 2,
  },
  recipeCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  recipeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recipeIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  recipeCompact: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
  },
  recipeParts: {
    color: '#f2ca50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  totalInfo: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(242,202,80,0.2)',
  },
  totalText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    fontStyle: 'italic',
  },
});
