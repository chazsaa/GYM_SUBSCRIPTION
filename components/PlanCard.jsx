import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { planImages } from '../data/subscriptionPlans';
import { COLORS } from '../theme/colors';

// One membership card: icon tile, name, price / duration, description,
// first benefits and a View Details button.
const BENEFITS_ON_CARD = 2;

const PlanCard = ({ plan, onViewDetails }) => {
  const shown = plan.benefits.slice(0, BENEFITS_ON_CARD);
  const hidden = plan.benefits.length - shown.length;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Image source={planImages[plan.id]} style={styles.photo} resizeMode="cover" />
        <View style={styles.info}>
          <Text style={styles.name}>{plan.name}</Text>
          <Text style={styles.priceLine}>
            <Text style={styles.price}>{plan.price}</Text>
            <Text style={styles.duration}>  /  {plan.duration}</Text>
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {plan.description}
          </Text>
        </View>
      </View>

      <View style={styles.benefits}>
        {shown.map((benefit) => (
          <View key={benefit} style={styles.benefitRow}>
            <MaterialCommunityIcons name="check" size={16} color={COLORS.accent} />
            <Text style={styles.benefitText}>{benefit}</Text>
          </View>
        ))}
        {hidden > 0 && <Text style={styles.more}>+ {hidden} more in details</Text>}
      </View>

      <TouchableOpacity
        style={styles.button}
        activeOpacity={0.85}
        onPress={onViewDetails}
        accessibilityRole="button"
        accessibilityLabel={`View details for ${plan.name}`}
      >
        <Text style={styles.buttonText}>View Details</Text>
        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.onPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  photo: {
    width: 84,
    height: 84,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.border,
    marginRight: 14,
  },
  info: { flex: 1 },
  name: { color: COLORS.text, fontSize: 17, fontWeight: '800' },
  priceLine: { marginTop: 2 },
  price: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  duration: { color: COLORS.textMuted, fontSize: 13 },
  description: { color: COLORS.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  benefits: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  benefitText: { flex: 1, color: COLORS.text, fontSize: 13, marginLeft: 6 },
  more: { color: COLORS.textMuted, fontSize: 12, marginTop: 2, marginLeft: 22 },
  button: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderRadius: 26,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  buttonText: { color: COLORS.onPrimary, fontSize: 15, fontWeight: '700' },
});

export default PlanCard;
