import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

// Reusable input with a label, an error message, and an optional right-side element.
// Other props (value, onChangeText, placeholder, ...) go straight to TextInput.
const FormInput = ({ label, error, rightElement, style, ...inputProps }) => {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          style={[
            styles.input,
            !!rightElement && styles.inputWithRightElement,
            !!error && styles.inputError,
            style,
          ]}
          placeholderTextColor={COLORS.placeholderMuted}
          {...inputProps}
        />
        {rightElement ? <View style={styles.rightElement}>{rightElement}</View> : null}
      </View>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  group: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  inputWrap: {
    justifyContent: 'center',
  },
  input: {
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: COLORS.text,
  },
  inputWithRightElement: {
    paddingRight: 64,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  rightElement: {
    position: 'absolute',
    right: 16,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12.5,
    marginTop: 6,
  },
});

export default FormInput;
