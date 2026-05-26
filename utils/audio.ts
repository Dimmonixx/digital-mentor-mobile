import { Audio } from 'expo-av';

export const playSuccessSound = async () => {
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      require('../assets/sounds/bell.mp3')
    );

    await sound.playAsync();

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.isLoaded && status.didJustFinish) {
        try {
          await sound.unloadAsync();
        } catch (error) {
          console.log('Глобальный сбой аудио:', error);
        }
      }
    });
  } catch (error) {
    console.log('Глобальный сбой аудио:', error);
  }
};
