import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import TabScreen from './TabScreen';
import PrimaryButton from './PrimaryButton';
import { COLORS, SHADES } from '../theme/colors';

// Simple "nothing here yet" screen used by Current and History.
const InfoScreen = ({ title, icon, heading, text, buttonLabel, onPress }) => (
  <TabScreen title={title}>
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <MaterialCommunityIcons name={icon} size={36} color={COLORS.accent} />
      </View>
      <Text style={styles.heading}>{heading}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
    <PrimaryButton label={buttonLabel} onPress={onPress} />
  </TabScreen>
);

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 28,
    marginBottom: 24,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: SHADES.maroonSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heading: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  text: { color: COLORS.textMuted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});

export default InfoScreen;
