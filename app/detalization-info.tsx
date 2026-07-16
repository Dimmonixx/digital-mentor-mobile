import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const SECTIONS = [
  {
    title: '🔍 Что это такое?',
    text: 'Оптическая диагностика — инструмент для внимательного осмотра поверхности зуба или реставрации. Он помогает разглядеть то, что не видно с первого взгляда: микрорельеф, трещины, переходы между материалами, качество текстуры.',
  },
  {
    title: '🦷 Когда использовать?',
    text: 'Используйте Оптическую диагностику после эталонного замера цвета — перед нанесением керамики или в процессе моделировки, чтобы оценить форму, рельеф и текстуру поверхности.',
  },
  {
    title: '🎛 Коррекция (необязательно)',
    text: 'Яркость — высвечивает тени и пришеечную область.\n\nКонтраст — усиливает различие между выпуклостями и впадинами.\n\nНасыщенность — помогает сравнивать оттенки и оценивать хроматику дентина.\n\nДетализация — подчёркивает границы и прозрачные зоны.\n\nЭто необязательный шаг — можно сразу перейти к ИИ-анализу.',
  },
  {
    title: '🎨 Режимы просмотра (необязательно)',
    text: 'Монохром — убирает цвет, остаётся только форма и рельеф.\n\nГлиняный — тёплый оттенок, как восковой макет — удобно оценивать объём.\n\nРельеф — повышенный контраст, видны мамелоны и микрорельеф.\n\nКонтурный — сильный контраст, подчёркивает границы форм.',
  },
  {
    title: '🔬 ИИ-анализ',
    text: 'Главная функция экрана. Отправьте фото на анализ — эксперт-ИИ оценит текстуру, прозрачность и макрорельеф реставрации, поставит оценки по каждому параметру и даст содержательный вывод с рекомендациями. Анализ учитывает выбранный режим просмотра — используйте его, чтобы подсказать ИИ, на что обратить особое внимание. Стоимость одного анализа — 1⚡ энергии.',
  },
  {
    title: '🔎 Лупа и панорама',
    text: 'Удержите палец на фото — появится круглое увеличение (×3.5) с теми же фильтрами, что и основное изображение.\n\nНажмите на значок лупы в углу фото, чтобы открыть полноэкранную панораму — экран развернётся в широкий формат, и вы сможете рассмотреть фото целиком в более высоком качестве.',
  },
  {
    title: '💾 Сохранение',
    text: 'Кнопка загрузки в правом углу шапки сохраняет текущее фото (с применёнными настройками) в галерею телефона.',
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
