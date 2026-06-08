import AsyncStorage from '@react-native-async-storage/async-storage';

const PRESET_AVATARS = [
  require('../assets/avatars/avatar_1.jpg'),
  require('../assets/avatars/avatar_2.jpg'),
  require('../assets/avatars/avatar_3.jpg'),
  require('../assets/avatars/avatar_4.jpg'),
  require('../assets/avatars/avatar_5.jpg'),
  require('../assets/avatars/avatar_6.jpg'),
  require('../assets/avatars/avatar_7.jpg'),
  require('../assets/avatars/avatar_8.jpg'),
  require('../assets/avatars/avatar_9.jpg'),
  require('../assets/avatars/avatar_10.jpg'),
];

export type UserIdentity = {
  name: string;
  shortName: string;
  role: string;
  avatarSource: any;
};

function formatShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const [last, first, middle] = parts;
  const firstI = first ? first[0].toUpperCase() + '.' : '';
  const middleI = middle ? middle[0].toUpperCase() + '.' : '';
  return `${last} ${firstI}${middleI}`;
}

export async function getUserIdentity(): Promise<UserIdentity | null> {
  try {
    const [rawUser, rawProfile] = await Promise.all([
      AsyncStorage.getItem('user'),
      AsyncStorage.getItem('userProfile'),
    ]);

    const user = rawUser ? JSON.parse(rawUser) : null;
    const profile = rawProfile ? JSON.parse(rawProfile) : null;

    if (!user) return null;

    const role =
      user.role === 'technician'
        ? 'Зубной техник'
        : user.role === 'doctor'
          ? 'Врач'
          : profile?.position?.toLowerCase().includes('техник')
            ? 'Зубной техник'
            : 'Врач';

    const fullName =
      profile?.lastName || profile?.firstName
        ? `${profile.lastName ?? ''} ${profile.firstName ?? ''}`.trim()
        : user.name ?? 'Пользователь';

    let avatarSource: any = null;
    if (profile?.avatarType === 'custom' && profile?.avatarUrl) {
      avatarSource = { uri: profile.avatarUrl };
    } else if (profile?.avatarPresetId) {
      avatarSource = PRESET_AVATARS[(profile.avatarPresetId - 1) % PRESET_AVATARS.length];
    }

    return {
      name: fullName,
      shortName: formatShortName(fullName),
      role,
      avatarSource,
    };
  } catch {
    return null;
  }
}
