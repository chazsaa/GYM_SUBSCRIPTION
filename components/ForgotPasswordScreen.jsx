import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import Screen from './Screen';
import Logo from './Logo';
import FormInput from './FormInput';
import PrimaryButton from './PrimaryButton';
import { COLORS } from '../theme/colors';

const ForgotPasswordScreen = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const handleSendResetLink = () => {
    if (!email.trim()) {
      setEmailError('Enter your email to continue.');
      return;
    }
    if (!isValidEmail(email.trim())) {
      setEmailError('Enter a valid email address.');
      return;
    }

    setEmailError('');
    console.log('Send reset link pressed:', { email });
    setIsSubmitted(true);
  };

  const handleBackToLogin = () => {
    router.back();
  };

  return (
    <Screen>
      <Logo />

      {!isSubmitted ? (
        <>
          <Text style={styles.welcomeTitle}>Forgot Password</Text>
          <Text style={styles.subtitle}>
            Enter the email linked to your account and we&apos;ll send you a link to reset your password.
          </Text>

          <FormInput
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (emailError) setEmailError('');
            }}
            error={emailError}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <PrimaryButton label="SEND RESET LINK" onPress={handleSendResetLink} />

          <View style={styles.bottomLinkContainer}>
            <Text style={styles.bottomLinkText}>Remembered your password? </Text>
            <TouchableOpacity onPress={handleBackToLogin}>
              <Text style={styles.bottomLinkAction}>Login</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.welcomeTitle}>Check Your Email</Text>
          <Text style={styles.subtitle}>
            If an account exists for{' '}
            <Text style={styles.emailHighlight}>{email}</Text>, a reset link is on
            its way. It expires in 30 minutes.
          </Text>

          <View style={styles.bottomLinkContainer}>
            <Text style={styles.bottomLinkText}>Back to </Text>
            <TouchableOpacity onPress={handleBackToLogin}>
              <Text style={styles.bottomLinkAction}>Login</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
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
    marginBottom: 36,
    lineHeight: 20,
  },
  emailHighlight: {
    color: COLORS.text,
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

export default ForgotPasswordScreen;
