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

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

// Three steps on one screen:
//   email -> the member enters their email and we send a 6-digit code
//   code  -> they type the code and choose a new password
//   done  -> password changed, go to Login
const ForgotPasswordScreen = () => {
  const router = useRouter();
  const { requestPasswordReset, resetPasswordWithCode } = useAuth();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const clearError = (field) => setErrors({ ...errors, [field]: '' });

  const handleSendCode = async () => {
    if (submitting) return;
    if (!email.trim()) {
      setErrors({ email: 'Enter your email to continue.' });
      return;
    }
    if (!isValidEmail(email.trim())) {
      setErrors({ email: 'Enter a valid email address.' });
      return;
    }
    setErrors({});
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setSubmitting(false);
    if (!result.ok) {
      setErrors({ email: result.message });
      return;
    }
    setNotice('');
    setStep('code');
  };

  const handleResend = async () => {
    if (submitting) return;
    setSubmitting(true);
    const result = await requestPasswordReset(email);
    setSubmitting(false);
    if (!result.ok) {
      setErrors({ code: result.message });
      return;
    }
    setErrors({});
    setCode('');
    setNotice('A new code was sent. Use the newest email.');
  };

  const handleReset = async () => {
    if (submitting) return;
    const nextErrors = {};
    if (!/^\d{6,10}$/.test(code.trim())) {
      nextErrors.code = 'Enter the 6-digit code from your email.';
    }
    if (!password) {
      nextErrors.password = 'Create a new password.';
    } else if (password.length < 8) {
      nextErrors.password = 'Use at least 8 characters.';
    }
    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Re-enter your new password.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    // The password is never logged.
    const result = await resetPasswordWithCode(email, code, password);
    setSubmitting(false);
    if (!result.ok) {
      setErrors({ [result.field || 'code']: result.message });
      return;
    }
    setStep('done');
  };

  const handleBackToLogin = () => {
    router.back();
  };

  const eyeButton = (visible, toggle) => (
    <TouchableOpacity
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      {visible ? (
        <EyeOff size={20} color={COLORS.textMuted} />
      ) : (
        <Eye size={20} color={COLORS.textMuted} />
      )}
    </TouchableOpacity>
  );

  if (step === 'done') {
    return (
      <Screen>
        <Logo />
        <Text style={styles.welcomeTitle}>Password Updated</Text>
        <Text style={styles.subtitle}>
          Your password has been changed. Log in with your new password.
        </Text>
        <PrimaryButton label="GO TO LOGIN" onPress={() => router.replace('/login')} />
      </Screen>
    );
  }

  if (step === 'code') {
    return (
      <Screen>
        <Logo />
        <Text style={styles.welcomeTitle}>Enter Your Code</Text>
        <Text style={styles.subtitle}>
          If an account exists for <Text style={styles.emailHighlight}>{email.trim()}</Text>, we sent
          it a 6-digit code. Enter it below and choose a new password.
        </Text>

        <FormInput
          label="Code from your email"
          placeholder="123456"
          value={code}
          onChangeText={(value) => {
            setCode(value.replace(/\D/g, ''));
            clearError('code');
          }}
          error={errors.code}
          keyboardType="number-pad"
          maxLength={10}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="oneTimeCode"
        />

        <FormInput
          label="New Password"
          placeholder="Create a new password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            clearError('password');
          }}
          error={errors.password}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          rightElement={eyeButton(showPassword, () => setShowPassword(!showPassword))}
        />

        <FormInput
          label="Confirm New Password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            clearError('confirmPassword');
          }}
          error={errors.confirmPassword}
          secureTextEntry={!showConfirm}
          autoCapitalize="none"
          rightElement={eyeButton(showConfirm, () => setShowConfirm(!showConfirm))}
        />

        {!!notice && <Text style={styles.notice}>{notice}</Text>}

        <PrimaryButton
          label={submitting ? 'PLEASE WAIT...' : 'RESET PASSWORD'}
          onPress={handleReset}
          disabled={submitting}
        />

        <View style={styles.bottomLinkContainer}>
          <Text style={styles.bottomLinkText}>Did not get it? </Text>
          <TouchableOpacity onPress={handleResend} accessibilityRole="button">
            <Text style={styles.bottomLinkAction}>Send a new code</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.bottomLinkContainer}>
          <TouchableOpacity
            onPress={() => {
              setStep('email');
              setErrors({});
              setCode('');
              setNotice('');
            }}
            accessibilityRole="button"
          >
            <Text style={styles.bottomLinkAction}>Use a different email</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Logo />
      <Text style={styles.welcomeTitle}>Forgot Password</Text>
      <Text style={styles.subtitle}>
        Enter the email linked to your account and we&apos;ll send you a 6-digit code to reset your
        password.
      </Text>

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

      <PrimaryButton
        label={submitting ? 'SENDING...' : 'SEND CODE'}
        onPress={handleSendCode}
        disabled={submitting}
      />

      <View style={styles.bottomLinkContainer}>
        <Text style={styles.bottomLinkText}>Remembered your password? </Text>
        <TouchableOpacity onPress={handleBackToLogin} accessibilityRole="button">
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
    marginBottom: 36,
    lineHeight: 20,
  },
  emailHighlight: {
    color: COLORS.text,
    fontWeight: '700',
  },
  notice: {
    color: COLORS.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 12,
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
