import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome } from '@expo/vector-icons';
import { Eye, EyeOff } from 'lucide-react-native';
import Screen from './Screen';
import Logo from './Logo';
import FormInput from './FormInput';
import PrimaryButton from './PrimaryButton';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const LoginScreen = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({}); // { email, password } messages
  const [loginError, setLoginError] = useState(''); // wrong email/password message

  const handleLogin = () => {
    const nextErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Enter your email address.';
    } else if (!isValidEmail(email.trim())) {
      nextErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      nextErrors.password = 'Enter your password.';
    }

    setErrors(nextErrors);
    setLoginError('');
    if (Object.keys(nextErrors).length > 0) return;

    // login() returns true or false. On success the auth state changes and
    // the router moves from Login to the Home screen (see app/_layout.jsx).
    // We never log or pass the password anywhere else.
    const success = login(email, password);
    if (!success) {
      setLoginError('Incorrect email or password. Please try again.');
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  const handleRegisterPress = () => {
    router.push('/register');
  };

  const handleGoogleLogin = () => {
    // TODO: connect to real Google OAuth flow (e.g. expo-auth-session / Firebase)
    console.log('Continue with Google pressed');
  };

  const handleFacebookLogin = () => {
    // TODO: connect to real Facebook OAuth flow
    console.log('Continue with Facebook pressed');
  };

  return (
    <Screen>
      {/* Logo / App Name */}
      <Logo />

      {/* Title */}
      <Text style={styles.welcomeTitle}>Welcome Back!</Text>
      <Text style={styles.subtitle}>Log in to see your membership plans.</Text>

      {/* Email Field */}
      <FormInput
        label="Email Address"
        placeholder="Enter your email"
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setErrors({ ...errors, email: '' });
          setLoginError('');
        }}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/* Password Field (with show/hide) */}
      <FormInput
        label="Password"
        placeholder="Enter your password"
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          setErrors({ ...errors, password: '' });
          setLoginError('');
        }}
        error={errors.password}
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        rightElement={
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
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

      {/* Forgot Password */}
      <TouchableOpacity
        style={styles.forgotPasswordContainer}
        onPress={handleForgotPassword}
      >
        <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
      </TouchableOpacity>

      {/* Friendly message when the email or password is wrong */}
      {!!loginError && <Text style={styles.loginError}>{loginError}</Text>}

      {/* Login Button */}
      <PrimaryButton label="LOGIN" onPress={handleLogin} />


      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or continue with</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Social Login */}
      <View style={styles.socialRow}>
        <TouchableOpacity
          style={styles.socialButton}
          activeOpacity={0.85}
          onPress={handleGoogleLogin}
        >
          <FontAwesome name="google" size={18} color={COLORS.text} />
          <Text style={styles.socialButtonText}>Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.socialButton}
          activeOpacity={0.85}
          onPress={handleFacebookLogin}
        >
          <FontAwesome name="facebook" size={18} color={COLORS.text} />
          <Text style={styles.socialButtonText}>Facebook</Text>
        </TouchableOpacity>
      </View>

      {/* Register Redirect */}
      <View style={styles.registerContainer}>
        <Text style={styles.registerText}>Don&apos;t have an account? </Text>
        <TouchableOpacity onPress={handleRegisterPress}>
          <Text style={styles.registerLink}>Register</Text>
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
  },
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginHorizontal: 12,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.cardBackground,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 13,
  },
  socialButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  registerText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  registerLink: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  loginError: {
    color: COLORS.error,
    fontSize: 13.5,
    textAlign: 'center',
    marginBottom: 14,
  },
});

export default LoginScreen;
