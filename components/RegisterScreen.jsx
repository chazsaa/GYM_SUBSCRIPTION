import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import Screen from './Screen';
import Logo from './Logo';
import FormInput from './FormInput';
import PrimaryButton from './PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';

const RegisterScreen = () => {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // errors is an object, for example: { email: 'Enter your email.' }
  const [errors, setErrors] = useState({});

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSignUp = () => {
    const nextErrors = {};

    if (!fullName.trim()) nextErrors.fullName = 'Enter your full name.';

    if (!email.trim()) {
      nextErrors.email = 'Enter your email.';
    } else if (!isValidEmail(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Create a password.';
    } else if (password.length < 8) {
      nextErrors.password = 'Use at least 8 characters.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Re-enter your password.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!agreed) nextErrors.agreed = 'You must agree to continue.';

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    // Save the demo account (in memory), then go back to Login.
    // The password is never logged.
    const result = register(fullName, email, password);
    if (!result.ok) {
      setErrors({ email: result.message });
      return;
    }
    router.back();
  };

  // Remove the error message of one field when the user edits it
  const clearError = (field) => {
    setErrors({ ...errors, [field]: '' });
  };

  const handleBackToLogin = () => {
    router.back();
  };

  return (
    <Screen>
      {/* Logo / App Name */}
      <Logo />

      {/* Title */}
      <Text style={styles.welcomeTitle}>Create Account</Text>
      <Text style={styles.subtitle}>
        Sign up to start tracking your membership and workouts.
      </Text>

      {/* Full Name Field */}
      <FormInput
        label="Full Name"
        placeholder="Enter your full name"
        value={fullName}
        onChangeText={(value) => {
          setFullName(value);
          clearError('fullName');
        }}
        error={errors.fullName}
        autoCapitalize="words"
      />

      {/* Email Field */}
      <FormInput
        label="Email Address"
        placeholder="Enter your email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          clearError('email');
        }}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Password Field */}
      <FormInput
        label="Password"
        placeholder="Create a password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          clearError('password');
        }}
        error={errors.password}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        rightElement={
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {showPassword ? (
              <EyeOff size={20} color={COLORS.textMuted} />
            ) : (
              <Eye size={20} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>
        }
      />

      {/* Confirm Password Field */}
      <FormInput
        label="Confirm Password"
        placeholder="Re-enter your password"
        value={confirmPassword}
        onChangeText={(value) => {
          setConfirmPassword(value);
          clearError('confirmPassword');
        }}
        error={errors.confirmPassword}
        secureTextEntry={!showConfirmPassword}
        autoCapitalize="none"
        rightElement={
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {showConfirmPassword ? (
              <EyeOff size={20} color={COLORS.textMuted} />
            ) : (
              <Eye size={20} color={COLORS.textMuted} />
            )}
          </TouchableOpacity>
        }
      />

      {/* Terms Checkbox */}
      <TouchableOpacity
        style={styles.termsRow}
        activeOpacity={0.8}
        onPress={() => {
          setAgreed(!agreed);
          clearError('agreed');
        }}
      >
        <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
          {agreed && <Text style={styles.checkboxMark}>✓</Text>}
        </View>
        <Text style={styles.termsText}>
          I agree to the <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
          <Text style={styles.termsLink}>Privacy Policy</Text>
        </Text>
      </TouchableOpacity>
      {!!errors.agreed && <Text style={styles.errorText}>{errors.agreed}</Text>}

      {/* Sign Up Button */}
      <PrimaryButton label="SIGN UP" onPress={handleSignUp} />

      {/* Login Redirect */}
      <View style={styles.bottomLinkContainer}>
        <Text style={styles.bottomLinkText}>Already have an account? </Text>
        <TouchableOpacity onPress={handleBackToLogin}>
          <Text style={styles.bottomLinkAction}>Login</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  );
};

const styles = StyleSheet.create({
  welcomeTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 32,
    lineHeight: 20,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12.5,
    marginTop: 6,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    marginBottom: 6,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
  termsText: {
    flex: 1,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  termsLink: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  bottomLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  bottomLinkText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  bottomLinkAction: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
});

export default RegisterScreen;
