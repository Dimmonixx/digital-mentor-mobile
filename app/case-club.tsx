import { CASES, CaseMedia, ClinicalCase } from '@/data/cases';
import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    Dimensions,
    FlatList,
    Image,
    ImageBackground,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MEDIA_WIDTH = SCREEN_WIDTH - 40 - 24; // screen padding (20*2) + card padding (12*2)

const MediaCarousel = ({ media }: { media: CaseMedia[] }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setActiveIndex(viewableItems[0].index ?? 0);
    }
  }).current;

  return (
    <View style={styles.mediaWrap}>
      <FlatList
        data={media}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item }) => (
          <View style={{ width: MEDIA_WIDTH }}>
            <Image source={{ uri: item.uri }} style={styles.mediaImage} />
            <View style={styles.stageBadge}>
              <Text style={styles.stageBadgeText}>{item.stage}</Text>
            </View>
          </View>
        )}
      />
      <View style={styles.dotsRow}>
        {media.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIndex && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
};

const CaseCard = ({ item }: { item: ClinicalCase }) => (
  <TouchableOpacity
    activeOpacity={0.9}
    style={styles.card}
    onPress={() => router.push({ pathname: '/case-details', params: { id: item.id } } as any)}
  >
    {/* Card header */}
    <View style={styles.cardHeader}>
      <View style={styles.authorRow}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        <Text style={styles.authorName}>{item.author}</Text>
      </View>
      <View style={[styles.roleBadge, item.role === 'Техник' && styles.roleBadgeTech]}>
        <Text style={[styles.roleBadgeText, item.role === 'Техник' && styles.roleBadgeTextTech]}>
          {item.role}
        </Text>
      </View>
    </View>

    {/* Media slider */}
    <MediaCarousel media={item.media} />

    {/* Hexagonal tags */}
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tagsRow}
    >
      {item.tags.map((tag) => (
        <View key={tag} style={styles.tagChip}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ))}
    </ScrollView>

    {/* Description */}
    <Text style={styles.description} numberOfLines={3}>
      {item.description}
    </Text>

    {/* Interaction bar */}
    <View style={styles.interactionBar}>
      <TouchableOpacity style={styles.commentsBtn} activeOpacity={0.7}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color="#4fc3f7" />
        <Text style={styles.commentsText}>{item.comments}</Text>
      </TouchableOpacity>
      <View style={styles.ratingBlock}>
        <Text style={styles.ratingLabel}>Эстетика:</Text>
        <Text style={styles.ratingValue}>{item.votes.aesthetics.avg.toFixed(1)}</Text>
        <Text style={styles.ratingDiamond}>💎</Text>
      </View>
    </View>
  </TouchableOpacity>
);

export default function CaseClubScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ImageBackground
      source={require('@/assets/images/background.png')}
      style={{ flex: 1, backgroundColor: 'transparent' }}
      resizeMode="cover"
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={28} color="#f2ca50" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Кейс-клуб</Text>
          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.8}
            onPress={() => router.push('/create-case' as any)}
          >
            <Ionicons name="add" size={28} color="#0b0e14" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={CASES}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CaseCard item={item} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  headerTitle: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#f2ca50',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#f2ca50',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
    paddingTop: 8,
  },
  card: {
    backgroundColor: 'rgba(20, 26, 40, 0.78)',
    borderRadius: 20,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderTopColor: 'rgba(255, 255, 255, 0.22)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(242, 202, 80, 0.6)',
    backgroundColor: '#1a2030',
  },
  authorName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
  roleBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.5)',
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
  },
  roleBadgeTech: {
    borderColor: 'rgba(79, 195, 247, 0.5)',
    backgroundColor: 'rgba(79, 195, 247, 0.1)',
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#f2ca50',
    letterSpacing: 0.5,
  },
  roleBadgeTextTech: {
    color: '#4fc3f7',
  },
  mediaWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  mediaImage: {
    width: MEDIA_WIDTH,
    height: 220,
    borderRadius: 14,
    backgroundColor: '#10141f',
  },
  stageBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(11, 14, 20, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
  },
  stageBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dotsRow: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  dotActive: {
    backgroundColor: '#f2ca50',
    width: 18,
  },
  tagsRow: {
    gap: 8,
    paddingVertical: 2,
    marginBottom: 12,
  },
  tagChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(242, 202, 80, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.35)',
    // flat-edge geometry (cut corners feel via small radius)
    borderRadius: 4,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f2ca50',
    letterSpacing: 0.3,
  },
  description: {
    fontSize: 13.5,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.82)',
    marginBottom: 14,
    paddingHorizontal: 2,
  },
  interactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: 12,
    paddingHorizontal: 2,
  },
  commentsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  commentsText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  ratingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(242, 202, 80, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(242, 202, 80, 0.3)',
  },
  ratingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  ratingValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#f2ca50',
  },
  ratingDiamond: {
    fontSize: 13,
  },
});
