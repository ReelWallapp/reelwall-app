import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import { decode } from 'base64-arraybuffer';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../lib/supabase';

type CatchItem = {
  id: string;
  uri: string;
  createdAt: string;
  placeName?: string;
  regionName?: string;
  weatherTemp?: number;
  weatherDescription?: string;
  note?: string;
  isPersonalBest?: boolean;
  source?: 'camera' | 'upload';
};

type FlashMode = 'off' | 'on' | 'auto';
type CameraFacingMode = 'front' | 'back';
type CaptureQuality = 'standard' | 'high';
type CaptureTimer = 0 | 3 | 10;

const STORAGE_KEY = 'reelwall_catches';
const WEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY;
const { width, height } = Dimensions.get('window');

export default function CaptureScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [saving, setSaving] = useState(false);
  const [flashSuccess, setFlashSuccess] = useState(false);
  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [facing, setFacing] = useState<CameraFacingMode>('back');
  const [showGrid, setShowGrid] = useState(true);
  const [qualityMode, setQualityMode] = useState<CaptureQuality>('high');
  const [zoom, setZoom] = useState(0);
  const [timer, setTimer] = useState<CaptureTimer>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const cameraRef = useRef<any>(null);

  const qualityValue = useMemo(() => {
    return qualityMode === 'high' ? 0.92 : 0.72;
  }, [qualityMode]);

  const sortCatchesNewestFirst = (items: CatchItem[]) => {
    return [...items].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

  const mapRowToCatch = (item: any): CatchItem => ({
    id: String(item.id),
    uri: item.image_url,
    createdAt: item.created_at,
    placeName: item.place_name || undefined,
    regionName: item.region_name || undefined,
    weatherTemp: item.weather_temp ?? undefined,
    weatherDescription: item.weather_description || undefined,
    note: item.note || '',
    isPersonalBest: item.is_personal_best ?? false,
    source: item.source || 'camera',
  });

  const getWeather = async (latitude: number, longitude: number) => {
    try {
      if (!WEATHER_API_KEY) return {};

      const res = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${WEATHER_API_KEY}&units=metric`
      );

      const data = await res.json();

      return {
        weatherTemp:
          typeof data?.main?.temp === 'number'
            ? Math.round(data.main.temp)
            : undefined,
        weatherDescription:
          typeof data?.weather?.[0]?.main === 'string'
            ? data.weather[0].main
            : undefined,
      };
    } catch (error) {
      console.log('Weather error:', error);
      return {};
    }
  };

  const normalizeImageForUpload = async (uri: string) => {
    const resized = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    const targetAspect = 4 / 3;
    const currentAspect = resized.width / resized.height;

    if (Math.abs(currentAspect - targetAspect) < 0.01) {
      return resized.uri;
    }

    let cropWidth = resized.width;
    let cropHeight = resized.height;
    let originX = 0;
    let originY = 0;

    if (currentAspect > targetAspect) {
      cropWidth = Math.round(resized.height * targetAspect);
      originX = Math.max(0, Math.floor((resized.width - cropWidth) / 2));
    } else {
      cropHeight = Math.round(resized.width / targetAspect);
      originY = Math.max(0, Math.floor((resized.height - cropHeight) / 2));
    }

    const cropped = await ImageManipulator.manipulateAsync(
      resized.uri,
      [
        {
          crop: {
            originX,
            originY,
            width: cropWidth,
            height: cropHeight,
          },
        },
      ],
      {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return cropped.uri;
  };

  const uploadImageToSupabase = async (uri: string) => {
    const fileExt = 'jpg';
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `public/${fileName}`;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    const { error: uploadError } = await supabase.storage
      .from('catches')
      .upload(filePath, decode(base64), {
        contentType: 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage.from('catches').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const saveCatch = async (
    localUri: string,
    source: 'camera' | 'upload'
  ) => {
    const normalizedUri = await normalizeImageForUpload(localUri);
    const publicImageUrl = await uploadImageToSupabase(normalizedUri);
    const createdAt = new Date().toISOString();

    let placeName: string | undefined;
    let regionName: string | undefined;
    let weatherTemp: number | undefined;
    let weatherDescription: string | undefined;

    // Only camera captures should collect location/weather.
    if (source === 'camera') {
      try {
        const locationPermission =
          await Location.requestForegroundPermissionsAsync();

        if (locationPermission.status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          const { latitude, longitude } = loc.coords;

          const geocode = await Location.reverseGeocodeAsync({
            latitude,
            longitude,
          });

          if (geocode.length > 0) {
            const place = geocode[0];
            placeName = [place.city, place.region].filter(Boolean).join(', ');
            regionName = place.region || undefined;
          }

          const weather = await getWeather(latitude, longitude);
          weatherTemp = weather.weatherTemp;
          weatherDescription = weather.weatherDescription;
        }
      } catch (locationError) {
        console.log('Location error:', locationError);
      }
    }
const {
  data: { user },
  error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
  throw new Error('User not logged in');
}


    const { data, error } = await supabase
      .from('catches')
      .insert([
        {
          user_id: user.id,
          image_url: publicImageUrl,
          note: '',
          place_name: source === 'upload' ? null : placeName || null,
          region_name: source === 'upload' ? null : regionName || null,
          weather_temp: source === 'upload' ? null : weatherTemp ?? null,
          weather_description:
            source === 'upload' ? null : weatherDescription || null,
          is_personal_best: false,
          created_at: createdAt,
          source,
        },
      ])
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    const existing: CatchItem[] = saved ? JSON.parse(saved) : [];

    const newCatch = mapRowToCatch(data);
    const updated = sortCatchesNewestFirst([newCatch, ...existing]);

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const finishSuccess = async () => {
    setSaving(false);
    setFlashSuccess(true);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    setTimeout(() => {
      setFlashSuccess(false);
      router.push('/(tabs)');
    }, 900);
  };

  const cycleFlash = async () => {
    if (saving) return;

    await Haptics.selectionAsync();

    setFlashMode((current) => {
      if (current === 'off') return 'on';
      if (current === 'on') return 'auto';
      return 'off';
    });
  };

  const flipCamera = async () => {
    if (saving) return;

    await Haptics.selectionAsync();
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleGrid = async () => {
    if (saving) return;

    await Haptics.selectionAsync();
    setShowGrid((current) => !current);
  };

  const toggleQuality = async () => {
    if (saving) return;

    await Haptics.selectionAsync();
    setQualityMode((current) => (current === 'high' ? 'standard' : 'high'));
  };

  const cycleTimer = async () => {
    if (saving) return;

    await Haptics.selectionAsync();
    setTimer((current) => {
      if (current === 0) return 3;
      if (current === 3) return 10;
      return 0;
    });
  };

  const resetZoom = async () => {
    if (saving) return;

    await Haptics.selectionAsync();
    setZoom(0);
  };

  const setQuickZoom = async (value: number) => {
    if (saving) return;

    await Haptics.selectionAsync();
    setZoom(value);
  };

  const runCountdown = async () => {
    if (timer === 0) return;

    for (let i = timer; i > 0; i--) {
      setCountdown(i);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    setCountdown(null);
  };

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) {
        Alert.alert('Camera not ready');
        return;
      }

      if (saving) return;

      await runCountdown();
      setSaving(true);

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const photo = await cameraRef.current.takePictureAsync({
        quality: qualityValue,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        Alert.alert('No photo captured');
        setSaving(false);
        return;
      }

      await saveCatch(photo.uri, 'camera');
      await finishSuccess();
    } catch (error: any) {
      console.log('Capture error:', error);
      setSaving(false);
      setCountdown(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Capture failed', error?.message || 'Please try again.');
    }
  };

  const pickImage = async () => {
    try {
      if (saving) return;

      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Photo access needed',
          'Please allow ReelWall to access your photos so you can upload catches.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: qualityValue,
        allowsEditing: false,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      setSaving(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      await saveCatch(result.assets[0].uri, 'upload');
      await finishSuccess();
    } catch (error: any) {
      console.log('Upload error:', error);
      setSaving(false);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Upload failed', error?.message || 'Please try again.');
    }
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionWrap}>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          ReelWall needs your camera to capture the moment.
        </Text>

        <TouchableOpacity
          onPress={requestPermission}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Allow Camera</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={pickImage} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Upload Instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
  ref={cameraRef}
  style={styles.camera}
  facing={facing}
  flash={flashMode}
  zoom={zoom}
  autofocus="on"
/>

      {showGrid && (
        <View pointerEvents="none" style={styles.gridOverlay}>
          <View style={styles.gridVerticalLeft} />
          <View style={styles.gridVerticalRight} />
          <View style={styles.gridHorizontalTop} />
          <View style={styles.gridHorizontalBottom} />
        </View>
      )}

      <View style={styles.topOverlay}>
        <TouchableOpacity
          style={styles.topIconButton}
          onPress={() => router.back()}
          disabled={saving || flashSuccess || countdown !== null}
        >
          <Ionicons name="chevron-back" size={22} color="#F5F7FA" />
        </TouchableOpacity>

        <Text style={styles.topText}>Capture Your Catch</Text>

        <View style={styles.topRightSpacer} />
      </View>

      <View style={styles.topControls}>
        <TouchableOpacity
          style={styles.topControlPill}
          onPress={cycleFlash}
          disabled={saving || flashSuccess || countdown !== null}
        >
          <Ionicons
            name={
              flashMode === 'off'
                ? 'flash-off'
                : flashMode === 'on'
                  ? 'flash'
                  : 'flash-outline'
            }
            size={16}
            color="#F2C94C"
          />
          <Text style={styles.topControlText}>
            {flashMode === 'off'
              ? 'Flash Off'
              : flashMode === 'on'
                ? 'Flash On'
                : 'Flash Auto'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.topControlPill}
          onPress={toggleQuality}
          disabled={saving || flashSuccess || countdown !== null}
        >
          <Ionicons name="sparkles-outline" size={16} color="#F2C94C" />
          <Text style={styles.topControlText}>
            {qualityMode === 'high' ? 'HD' : 'Fast'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.topControlPill}
          onPress={toggleGrid}
          disabled={saving || flashSuccess || countdown !== null}
        >
          <Ionicons
            name={showGrid ? 'grid-outline' : 'square-outline'}
            size={16}
            color="#F2C94C"
          />
          <Text style={styles.topControlText}>
            {showGrid ? 'Grid On' : 'Grid Off'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.topControlPill}
          onPress={cycleTimer}
          disabled={saving || flashSuccess || countdown !== null}
        >
          <Ionicons name="timer-outline" size={16} color="#F2C94C" />
          <Text style={styles.topControlText}>
            {timer === 0 ? 'Timer Off' : `${timer}s Timer`}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.zoomPanel}>
        <View style={styles.zoomHeaderRow}>
          <View style={styles.zoomTitleWrap}>
            <Ionicons name="search-outline" size={16} color="#F2C94C" />
            <Text style={styles.zoomTitle}>Zoom</Text>
          </View>

          <TouchableOpacity
            onPress={resetZoom}
            disabled={saving || flashSuccess || countdown !== null}
            style={styles.zoomResetButton}
          >
            <Text style={styles.zoomResetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.quickZoomRow}>
          <TouchableOpacity
            style={[
              styles.quickZoomButton,
              zoom < 0.15 && styles.quickZoomButtonActive,
            ]}
            onPress={() => setQuickZoom(0)}
            disabled={saving || flashSuccess || countdown !== null}
          >
            <Text
              style={[
                styles.quickZoomText,
                zoom < 0.15 && styles.quickZoomTextActive,
              ]}
            >
              1x
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickZoomButton,
              zoom >= 0.15 && zoom < 0.45 && styles.quickZoomButtonActive,
            ]}
            onPress={() => setQuickZoom(0.3)}
            disabled={saving || flashSuccess || countdown !== null}
          >
            <Text
              style={[
                styles.quickZoomText,
                zoom >= 0.15 && zoom < 0.45 && styles.quickZoomTextActive,
              ]}
            >
              2x
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickZoomButton,
              zoom >= 0.45 && styles.quickZoomButtonActive,
            ]}
            onPress={() => setQuickZoom(0.6)}
            disabled={saving || flashSuccess || countdown !== null}
          >
            <Text
              style={[
                styles.quickZoomText,
                zoom >= 0.45 && styles.quickZoomTextActive,
              ]}
            >
              3x
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.zoomRow}>
          <Text style={styles.zoomLabel}>1x</Text>

          <Slider
            style={styles.slider}
            minimumValue={0}
            maximumValue={0.9}
            value={zoom}
            onValueChange={setZoom}
            minimumTrackTintColor="#F2C94C"
            maximumTrackTintColor="rgba(255,255,255,0.22)"
            thumbTintColor="#F2C94C"
            disabled={saving || flashSuccess || countdown !== null}
          />

          <Text style={styles.zoomLabel}>{(1 + zoom * 3).toFixed(1)}x</Text>
        </View>
      </View>

      <View style={styles.bottomPanel}>
        <TouchableOpacity
          style={styles.sideButton}
          onPress={pickImage}
          disabled={saving || flashSuccess || countdown !== null}
        >
          <Ionicons name="images-outline" size={22} color="#F5F7FA" />
          <Text style={styles.sideButtonText}>Upload</Text>
        </TouchableOpacity>

        <View style={styles.captureWrap}>
          <TouchableOpacity
            style={[styles.captureOuter, saving && styles.captureOuterDisabled]}
            onPress={takePhoto}
            disabled={saving || flashSuccess || countdown !== null}
            activeOpacity={0.9}
          >
            {saving ? (
              <ActivityIndicator size="large" color="#F2C94C" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>

          <Text style={styles.captureHint}>
            {countdown !== null
              ? `Starting in ${countdown}...`
              : saving
                ? 'Saving...'
                : timer === 0
                  ? 'Tap to capture'
                  : `Tap for ${timer}s timer`}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.sideButton}
          onPress={flipCamera}
          disabled={saving || flashSuccess || countdown !== null}
        >
          <Ionicons name="camera-reverse-outline" size={22} color="#F5F7FA" />
          <Text style={styles.sideButtonText}>Flip</Text>
        </TouchableOpacity>
      </View>

      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <View style={styles.countdownCircle}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        </View>
      )}

      {flashSuccess && (
        <View style={styles.flashOverlay}>
          <View style={styles.flashCard}>
            <Text style={styles.flashEmoji}>✓</Text>
            <Text style={styles.flashTitle}>Catch Saved</Text>
            <Text style={styles.flashText}>Adding it to your wall...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  permissionWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#081E33',
    padding: 24,
  },
  permissionTitle: {
    color: '#F5F7FA',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
  },
  permissionText: {
    color: '#A5B3C2',
    marginBottom: 18,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#F2C94C',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#0A2540',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#163554',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 14,
  },
  secondaryButtonText: {
    color: '#F5F7FA',
    fontSize: 15,
    fontWeight: '700',
  },
  topOverlay: {
    position: 'absolute',
    top: 62,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(8,30,51,0.74)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.28)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
  },
  topRightSpacer: {
    width: 44,
  },
  topControls: {
    position: 'absolute',
    top: 116,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: 6,
  },
  topControlPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(8,30,51,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.18)',
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 999,
  },
  topControlText: {
    color: '#F5F7FA',
    fontSize: 11,
    fontWeight: '700',
  },
  zoomPanel: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 150,
    backgroundColor: 'rgba(8,30,51,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.18)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  zoomHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  zoomTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  zoomTitle: {
    color: '#F5F7FA',
    fontSize: 14,
    fontWeight: '800',
  },
  zoomResetButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(242,201,76,0.14)',
  },
  zoomResetText: {
    color: '#F2C94C',
    fontSize: 12,
    fontWeight: '800',
  },
  quickZoomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 6,
  },
  quickZoomButton: {
    minWidth: 56,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
  },
  quickZoomButtonActive: {
    backgroundColor: '#F2C94C',
    borderColor: '#F2C94C',
  },
  quickZoomText: {
    color: '#F5F7FA',
    fontSize: 13,
    fontWeight: '800',
  },
  quickZoomTextActive: {
    color: '#0A2540',
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  zoomLabel: {
    color: '#F5F7FA',
    fontSize: 12,
    fontWeight: '700',
    width: 36,
    textAlign: 'center',
  },
  slider: {
    flex: 1,
    height: 28,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  gridVerticalLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: width / 3,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  gridVerticalRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: (width / 3) * 2,
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  gridHorizontalTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: height / 3,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  gridHorizontalBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (height / 3) * 2,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 40,
    left: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  sideButton: {
    width: 82,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(8,30,51,0.82)',
    borderWidth: 1,
    borderColor: '#163554',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sideButtonText: {
    color: '#F5F7FA',
    fontWeight: '700',
    fontSize: 13,
  },
  captureWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  captureOuterDisabled: {
    opacity: 0.9,
  },
  captureInner: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: '#F2C94C',
  },
  captureHint: {
    marginTop: 8,
    color: '#F5F7FA',
    fontSize: 12,
    fontWeight: '700',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  countdownCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(8,30,51,0.78)',
    borderWidth: 2,
    borderColor: 'rgba(242,201,76,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countdownText: {
    color: '#F2C94C',
    fontSize: 56,
    fontWeight: '900',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 30, 51, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  flashCard: {
    backgroundColor: '#102C47',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 32,
    alignItems: 'center',
    minWidth: 220,
  },
  flashEmoji: {
    color: '#F2C94C',
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 10,
  },
  flashTitle: {
    color: '#F5F7FA',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  flashText: {
    color: '#A5B3C2',
    fontSize: 14,
  },
});