import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SECTIONS = [
  {
    title: '🔍 Что это такое?',
    text: 'Детализация — это инструмент для глубокого анализа поверхности зуба или реставрации. Он помогает увидеть то, что не видно невооружённым глазом: микрорельеф, трещины, переходы между материалами.',
  },
  {
    title: '🦷 Когда использовать?',
    text: 'Используйте Детализацию после эталонного замера цвета. Перед нанесением керамики или в процессе моделировки — чтобы оценить форму, рельеф и текстуру поверхности.',
  },
  {
    title: '🎛 Коррекция',
    text: 'Яркость — высвечивает тени и пришеечную область.\n\nКонтраст — усиливает различие между выпуклостями и впадинами.\n\nНасыщенность — помогает сравнивать оттенки и оценивать хроматику дентина.\n\nДетализация — подчёркивает границы, мамелоны и прозрачные зоны.',
  },
  {
    title: '🎨 Режимы просмотра',
    text: 'Монохром — убирает цвет, остаётся только форма и рельеф. Идеально для оценки поверхности без отвлекающих оттенков.\n\nГлиняный — имитирует вид воска или глины. Помогает оценить объём как скульптору.\n\nРельеф — максимально усиливает все неровности. Каждый бугорок и впадина видны чётко.\n\nКонтурный — показывает только линии и границы форм, как технический чертёж.',
  },
  {
    title: '⚡ Пресеты',
    text: 'Готовые наборы настроек для типичных задач:\n\n• Анализ трещин — максимальный контраст и детализация\n• Мамелоны — акцент на локальные переходы\n• Цвет дентина — усиленная насыщенность\n• Рельеф — монохром с высоким контрастом',
  },
  {
    title: '📍 Метки',
    text: 'Нажмите иконку метки в шапке — затем тапните на фото чтобы поставить точку с подписью. Используйте для обозначения проблемных зон: мамелон, трещина, граница масс. Долгое нажатие на метку удаляет её.',
  },
  {
    title: '🔎 Лупа',
    text: 'Удержите палец на любом участке фото — появится круглое увеличение в 2× с теми же фильтрами что и основное изображение.',
  },
  {
    title: '💾 Сохранение',
    text: 'Кнопка загрузки в правом углу шапки сохраняет текущее фото в галерею телефона.',
  },
];

export default function DetalizationInfo() {
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, backgroundColor: '#05080f' }}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: 'rgba(242,202,80,0.18)',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={24} color="#f2ca50" />
        </TouchableOpacity>
        <Text style={{ color: '#f2ca50', fontSize: 18, fontWeight: '700' }}>
          О функции Детализация
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        {SECTIONS.map((section, i) => (
          <View key={i} style={{ marginBottom: 24 }}>
            <Text style={{ color: '#f2ca50', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>
              {section.title}
            </Text>
            <Text style={{ color: '#ccc', fontSize: 14, lineHeight: 22 }}>
              {section.text}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
