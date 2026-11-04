import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
} from 'react-native';
// 👇 SafeAreaView yahan se import kiya
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

// ============================================================
// TYPES
// ============================================================

type TermsPolicyDialogProps = {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
};

// ============================================================
// COMPONENT
// ============================================================

export default function TermsPolicyDialog({
  open,
  onClose,
  onAccept,
}: TermsPolicyDialogProps) {
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const scrollViewRef = useRef<any>(null);

  // Reset scroll state each time the screen opens
  useEffect(() => {
    if (open) {
      setScrolledToEnd(false);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 100);
    }
  }, [open]);

  const effectiveDate = '05-10-2026';
  const lastUpdated = '05-10-2026';

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;

    if (isCloseToBottom && !scrolledToEnd) {
      setScrolledToEnd(true);
    }
  };

  // 👇 Agar open nahi hai toh kuch bhi render mat karo
  if (!open) return null;

  return (
    <View style={styles.fullScreenContainer}>
      <StatusBar barStyle="dark-content" />
      
      {/* 👇 SafeAreaView with edges */}
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTextContainer}>
            <Text style={styles.brandText}>QUTON CONNECT</Text>
            <Text style={styles.titleText}>Terms & Policy</Text>
            <Text style={styles.subtitleText}>
              Terms of Service · Privacy Policy
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeIconButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Icon name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Body - Scrollable Content */}
        <ScrollView
          ref={scrollViewRef}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollBody}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={true}
        >
          <Text style={styles.metaText}>
            <Text style={styles.boldText}>Effective Date: </Text>
            {effectiveDate}
            {'\n'}
            <Text style={styles.boldText}>Last Updated: </Text>
            {lastUpdated}
          </Text>

          <Text style={styles.paragraph}>
            Welcome to <Text style={styles.boldTextBlack}>Quton Connect</Text>.
          </Text>

          <Text style={styles.paragraph}>
            These Terms & Policy explain the rules for using Quton Connect and
            how we collect, use, store, protect, and manage information
            associated with your Connect account.
          </Text>

          <Text style={styles.paragraph}>
            By creating or using a Quton Connect account, you acknowledge that
            you have read, understood, and agreed to these Terms & Policy.
          </Text>

          <Text style={styles.paragraph}>
            If you do not agree with these Terms & Policy, please do not create
            or use a Quton Connect account.
          </Text>

          <View style={styles.divider} />

          <Section title="1. About Quton Connect">
            <Text style={styles.paragraph}>
              Quton Connect is a communication and account service provided by{' '}
              <Text style={styles.boldTextBlack}>
                Quton-Connect, Inc. and its affiliates
              </Text>{' '}
              ("Quton", "we", "us", or "our").
            </Text>
            <Text style={styles.paragraph}>
              Quton Connect may provide users with a unique Connect address,
              communication features, account services, security features, and
              other related services.
            </Text>
            <Text style={styles.paragraph}>
              Features may change, improve, expand, or be discontinued over
              time.
            </Text>
          </Section>

          <Section title="2. Creating Your Connect">
            <Text style={styles.paragraph}>
              To create a Connect account, you may be asked to provide
              information such as:
            </Text>
            <Ul
              items={[
                'First name',
                'Last name',
                'Username',
                'Password',
                'Date of birth',
                'Recovery Connect',
                'Phone number',
                'Other information required for account security or service functionality',
              ]}
            />
            <Text style={styles.paragraph}>
              Some information may be optional.
            </Text>
            <Text style={styles.paragraph}>
              When information is optional, you may choose to skip it and add or
              update it later through your account Settings, where that
              functionality is available.
            </Text>
            <Text style={styles.paragraph}>
              You are responsible for providing information that is accurate and
              reasonably up to date.
            </Text>
          </Section>

          <Section title="3. Your Connect Address">
            <Text style={styles.paragraph}>
              Your username may be used to create your Connect address, such as:
            </Text>
            <Text style={[styles.paragraph, styles.linkColor]}>
              username@quton.com
            </Text>
            <Text style={styles.paragraph}>
              Your Connect address may become associated with your account and
              may be used to identify your Connect account within Quton
              services.
            </Text>
            <Text style={styles.paragraph}>
              You should choose a username that does not intentionally
              impersonate another person, organization, brand, or entity.
            </Text>
            <Text style={styles.paragraph}>
              We may restrict, reclaim, change, or disable usernames or Connect
              addresses when reasonably necessary, including for security, abuse
              prevention, legal compliance, trademark concerns, or service
              administration.
            </Text>
          </Section>

          <Section title="4. Account Security">
            <Text style={styles.paragraph}>
              You are responsible for keeping your account credentials
              confidential.
            </Text>
            <Text style={styles.paragraph}>You should:</Text>
            <Ul
              items={[
                'Use a strong and unique password.',
                'Never intentionally share your password.',
                'Avoid using the same password across multiple services.',
                'Keep your recovery information secure.',
                'Notify us if you believe your account has been compromised.',
              ]}
            />
            <Text style={styles.paragraph}>
              You are responsible for activity occurring through your account to
              the extent permitted by applicable law.
            </Text>
            <Text style={styles.paragraph}>
              Quton will take reasonable measures designed to protect accounts
              and systems, but no internet-connected service can guarantee
              absolute security.
            </Text>
          </Section>

          <Section title="5. Account Verification">
            <Text style={styles.paragraph}>
              Quton may require account verification before certain services or
              features become available.
            </Text>
            <Text style={styles.paragraph}>Verification may include:</Text>
            <Ul
              items={[
                'Email or Connect verification',
                'One-time verification codes',
                'Phone verification',
                'Security checks',
                'Additional account verification when required',
              ]}
            />
            <Text style={styles.paragraph}>
              Verification information may be processed for account creation,
              security, fraud prevention, and service integrity.
            </Text>
          </Section>

          <Section title="6. Acceptable Use">
            <Text style={styles.paragraph}>
              You agree to use Quton Connect responsibly and lawfully.
            </Text>
            <Text style={styles.paragraph}>
              You must not use Quton Connect to:
            </Text>
            <Ul
              items={[
                'Break applicable laws or regulations.',
                'Impersonate another person or organization.',
                'Harass, threaten, stalk, or intimidate others.',
                'Send spam or unwanted bulk communications.',
                'Distribute malware, viruses, or harmful software.',
                'Attempt unauthorized access to accounts or systems.',
                'Attempt to bypass security controls.',
                'Conduct phishing or credential theft.',
                'Commit fraud or facilitate fraudulent activity.',
                "Distribute content that unlawfully violates another person's rights.",
                'Abuse automated systems or service infrastructure.',
                'Interfere with the normal operation of Quton Connect.',
                'Use the service for activities that could reasonably cause harm to Quton, its users, or third parties.',
              ]}
            />
            <Text style={styles.paragraph}>
              We may take appropriate action when we reasonably believe an
              account or activity violates these Terms & Policy.
            </Text>
          </Section>

          {/* Baaki sections yahan tak same rahenge... */}
          <Section title="44. Your Agreement">
            <Text style={styles.paragraph}>
              By selecting{' '}
              <Text style={styles.boldTextBlack}>
                "I agree to the Quton Connect Terms & Policy"
              </Text>
              , creating a Connect account, or continuing to use Quton Connect
              where acceptance is required, you confirm that:
            </Text>
            <Ul
              items={[
                'You have read these Terms & Policy.',
                'You understand the important rules described here.',
                'You understand how your information may be processed as described here.',
                'You agree to comply with the Terms of Service.',
                'You acknowledge the Privacy Policy.',
                'You understand that some optional information can be added later through Settings where available.',
                'You understand that account security is your responsibility.',
                'You agree to use Quton Connect lawfully and responsibly.',
              ]}
            />
            <Text style={styles.paragraph}>
              If you do not agree, do not create the account.
            </Text>
          </Section>

          <Section title="45. Acceptance Checkbox">
            <Text style={styles.paragraph}>
              Before creating your Connect, you must confirm:
            </Text>
            <View style={styles.acceptanceBox}>
              <Text style={styles.boldTextBlack}>
                ☐ I have read and agree to the Quton Connect Terms & Policy,
                including the Terms of Service and Privacy Policy.
              </Text>
            </View>
            <Text style={styles.paragraph}>
              The checkbox should be required before account creation.
            </Text>
          </Section>

          <View style={styles.divider} />

          <View>
            <Text style={styles.thankYouTitle}>Thank You for Connecting</Text>
            <Text style={[styles.paragraph, { marginTop: 12 }]}>
              You're almost ready.
            </Text>
            <Text style={[styles.paragraph, { marginTop: 12 }]}>
              Your Connect is more than a username — it is your place within the
              Quton Connect experience.
            </Text>
            <Text style={[styles.paragraph, { marginTop: 12 }]}>
              Take a moment to review this Terms & Policy, make sure everything
              is clear, and when you're ready:
            </Text>
            <Text style={[styles.paragraph, { marginTop: 12 }]}>
              <Text style={styles.boldTextBlack}>Create your Connect.</Text>
            </Text>
            <Text style={[styles.paragraph, { marginTop: 12 }]}>
              Welcome to Quton Connect. 💙
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.footerMeta}>
            <Text style={styles.metaText}>
              <Text style={styles.boldText}>Quton-Connect, Inc.</Text>
            </Text>
            <Text style={styles.metaText}>
              <Text style={styles.boldText}>
                Terms & Policy — Terms of Service + Privacy Policy
              </Text>
            </Text>
            <Text style={[styles.metaText, { marginTop: 8 }]}>
              <Text style={styles.boldText}>Effective Date: </Text>
              {effectiveDate}
              {'\n'}
              <Text style={styles.boldText}>Last Updated: </Text>
              {lastUpdated}
            </Text>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerStatusText}>
            {scrolledToEnd
              ? "You've read the end of the terms & policy. You can now accept."
              : 'Please read the terms & policy to enable the accept button.'}
          </Text>

          <View style={styles.footerButtons}>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>

            {onAccept && (
              <TouchableOpacity
                onPress={() => {
                  onAccept();
                  onClose();
                }}
                disabled={!scrolledToEnd}
                style={[
                  styles.acceptBtn,
                  !scrolledToEnd && styles.acceptBtnDisabled,
                ]}
                activeOpacity={0.8}
              >
                <Text style={styles.acceptBtnText}>I agree</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ============================================================
// HELPERS
// ============================================================

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>{children}</View>
    </View>
  );
}

function Ul({ items }: { items: string[] }) {
  return (
    <View style={styles.ulContainer}>
      {items.map((item, index) => (
        <View key={index} style={styles.liRow}>
          <Text style={styles.bulletText}>•</Text>
          <Text style={styles.liText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

// ============================================================
// STYLES
// ============================================================

const styles = StyleSheet.create({
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 999,
  },
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  headerTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  brandText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    color: '#4285F4',
    marginBottom: 4,
  },
  titleText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 13,
    color: '#64748B',
  },
  closeIconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    marginLeft: 12,
  },
  scrollBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 24,
    paddingBottom: 40,
  },
  metaText: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 20,
    marginBottom: 16,
  },
  boldText: {
    fontWeight: '600',
    color: '#334155',
  },
  boldTextBlack: {
    fontWeight: '600',
    color: '#0F172A',
  },
  paragraph: {
    fontSize: 14,
    lineHeight: 24,
    color: '#334155',
    marginBottom: 12,
  },
  linkColor: {
    color: '#4285F4',
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 12,
  },
  sectionContent: {
    gap: 8,
  },
  ulContainer: {
    marginVertical: 8,
    paddingLeft: 8,
  },
  liRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingRight: 8,
  },
  bulletText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#334155',
    marginRight: 8,
  },
  liText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 24,
    color: '#334155',
  },
  acceptanceBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginVertical: 12,
  },
  thankYouTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  footerMeta: {
    marginTop: 8,
    marginBottom: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: Platform.OS === 'ios' ? 'column' : 'row',
    alignItems: Platform.OS === 'ios' ? 'stretch' : 'center',
    justifyContent: 'space-between',
  },
  footerStatusText: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: Platform.OS === 'ios' ? 12 : 0,
    flex: 1,
    marginRight: Platform.OS === 'ios' ? 0 : 16,
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  closeBtn: {
    height: 44,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  acceptBtn: {
    height: 44,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#4285F4',
  },
  acceptBtnDisabled: {
    opacity: 0.5,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});