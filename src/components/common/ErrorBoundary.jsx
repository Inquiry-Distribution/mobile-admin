/**
 * ErrorBoundary
 * Catches unhandled JS errors in the render tree and shows a friendly
 * fallback screen instead of a blank/crashed app.
 *
 * Usage (wrap RootNavigator in App.jsx):
 *   <ErrorBoundary>
 *     <RootNavigator />
 *   </ErrorBoundary>
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { COLORS } from '@constants/colors';

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text ?? '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary ?? '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  retryBtn: {
    backgroundColor: COLORS.primary ?? '#7C3AED',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 16,
  },
  retryText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  detailsToggle: {
    marginTop: 8,
    padding: 8,
  },
  detailsToggleText: {
    color: COLORS.primary ?? '#7C3AED',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  detailsBox: {
    marginTop: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
    width: '100%',
  },
  detailsText: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    fontSize: 11,
    color: '#374151',
  },
});

// ─── Component ────────────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Hook for external error reporters (Sentry, Crashlytics, etc.)
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, errorInfo);
    }

    if (__DEV__) {
      console.error('[ErrorBoundary] Caught error:', error);
      console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    });
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, errorInfo, showDetails } = this.state;
    const stack = errorInfo?.componentStack ?? '';
    const message = error?.message ?? String(error ?? 'Unknown error');

    return (
      <View style={styles.container}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>⚠️</Text>
        </View>

        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.subtitle}>
          The app ran into an unexpected problem.{'\n'}
          Tap below to try again — your data is safe.
        </Text>

        <TouchableOpacity style={styles.retryBtn} onPress={this.handleRetry} activeOpacity={0.85}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>

        {__DEV__ && (
          <>
            <TouchableOpacity style={styles.detailsToggle} onPress={this.toggleDetails}>
              <Text style={styles.detailsToggleText}>
                {showDetails ? 'Hide error details' : 'Show error details'}
              </Text>
            </TouchableOpacity>

            {showDetails && (
              <ScrollView style={styles.detailsBox} nestedScrollEnabled>
                <Text style={styles.detailsText}>
                  {message}
                  {stack ? `\n\n${stack}` : ''}
                </Text>
              </ScrollView>
            )}
          </>
        )}
      </View>
    );
  }
}

export default ErrorBoundary;
