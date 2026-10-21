import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';

// Wrapper for the Current / History / Profile tabs: title + scrolling body.
const TabScreen = ({ title, children }) => (
  <SafeAreaView style={styles.safe} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      <View>{children}</View>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800', marginBottom: 20 },
});

export default TabScreen;
