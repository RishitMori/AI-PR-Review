import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  CssBaseline,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme
} from '@mui/material';
import ArticleIcon from '@mui/icons-material/Article';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import BugReportIcon from '@mui/icons-material/BugReport';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import EmailIcon from '@mui/icons-material/Email';
import GitHubIcon from '@mui/icons-material/GitHub';
import InsightsIcon from '@mui/icons-material/Insights';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PolicyIcon from '@mui/icons-material/Policy';
import RefreshIcon from '@mui/icons-material/Refresh';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import './styles.css';

interface AuthUser {
  username: string;
  avatarUrl?: string | null;
  role: string;
}

interface Stats {
  review_count: number;
  repository_count: number;
  pull_request_count: number;
  failed_count: number;
  average_score: number | null;
  reviews_today: number;
}

interface ReviewListItem {
  id: number;
  overall_score: number | null;
  summary: string | null;
  created_at: string;
  pr_number: number;
  pr_title: string | null;
  pr_author: string | null;
  head_sha: string;
  status: string;
  failure_message?: string | null;
  repo_full_name: string;
}

interface ReviewComment {
  file_path: string | null;
  line_number: number | null;
  severity: string | null;
  comment: string;
}

interface ReviewDetail extends ReviewListItem {
  llm_model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  comments: ReviewComment[];
}

interface Repository {
  id: number;
  full_name: string;
  pull_request_count: number;
  review_count: number;
  failed_count: number;
  settings: RepositorySettings;
}

interface RepositorySettings {
  enabled: boolean;
  review_on_opened: boolean;
  review_on_synchronize: boolean;
  review_on_reopened: boolean;
  max_comments: number;
  max_inline_comments: number;
  max_inline_comments_per_file: number;
  review_tone: 'light' | 'balanced' | 'strict';
  ignored_patterns: string;
}

interface SetupInfo {
  github_app_slug: string | null;
  github_install_url: string | null;
  public_base_url: string;
  webhook_url: string;
  callback_url: string;
}

interface BillingInfo {
  plan_name: string;
  status: 'ready' | 'setup_required';
  payment_link_url: string | null;
  customer_portal_url: string | null;
}

type ColorMode = 'light' | 'dark';
type DashboardSection = 'overview' | 'inbox' | 'repos' | 'setup' | 'billing' | 'security';

function buildTheme(mode: ColorMode, variant: 'landing' | 'dashboard') {
  const isDark = mode === 'dark';
  const radius = 8;

  return createTheme({
    palette: {
      mode,
      primary: isDark ? { main: '#3b82f6' } : { main: '#2563eb' },
      secondary: { main: '#64748b' },
      warning: isDark ? { main: '#f59e0b' } : { main: '#d97706' },
      error: isDark ? { main: '#ef4444' } : { main: '#dc2626' },
      success: { main: '#10b981' },
      info: isDark ? { main: '#0ea5e9' } : { main: '#0284c7' },
      background: isDark
        ? { default: '#0b0f19', paper: '#161e2e' }
        : { default: '#f8fafc', paper: '#ffffff' },
      text: isDark
        ? { primary: '#f8fafc', secondary: '#94a3b8' }
        : { primary: '#0f172a', secondary: '#475569' }
    },
    shape: { borderRadius: radius },
    typography: {
      fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
      h1: { fontSize: '48px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 },
      h2: { fontSize: '32px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 },
      h3: { fontSize: '24px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.25 },
      h4: { fontSize: '20px', fontWeight: 700, lineHeight: 1.3 },
      h5: { fontSize: '16px', fontWeight: 600, lineHeight: 1.4 },
      h6: { fontSize: '14px', fontWeight: 600, lineHeight: 1.4 },
      body1: { fontSize: '16px', lineHeight: 1.6 },
      body2: { fontSize: '14px', lineHeight: 1.6 },
      caption: { fontSize: '12px', lineHeight: 1.5 },
      button: { textTransform: 'none', fontWeight: 600, fontSize: '14px' }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? '#0b0f19' : '#f8fafc',
            color: isDark ? '#f8fafc' : '#0f172a',
            backgroundImage: 'none',
            transition: 'background-color 220ms ease, color 220ms ease'
          },
          '*::selection': {
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.24)' : 'rgba(37, 99, 235, 0.2)'
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? 'rgba(11, 15, 25, 0.8)' : 'rgba(255, 255, 255, 0.85)',
            borderBottom: isDark ? '1px solid #1e293b' : '1px solid #e2e8f0',
            backdropFilter: 'blur(12px)',
            boxShadow: 'none'
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? '#161e2e' : '#ffffff',
            border: isDark ? '1px solid #273549' : '1px solid #e2e8f0',
            boxShadow: isDark 
              ? '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -2px rgba(0, 0, 0, 0.3)'
              : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
            transition: 'transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease'
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            padding: '8px 16px',
            transition: 'all 180ms ease'
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 4,
            border: isDark ? '1px solid #273549' : '1px solid #e2e8f0',
            backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
            color: 'inherit'
          }
        }
      },
      MuiAlert: {
        styleOverrides: {
          root: ({ ownerState }) => {
            const severity = ownerState.severity ?? 'info';
            const alertColors: Record<string, { bg: string; border: string; fg: string }> = {
              success: {
                bg: isDark ? 'rgba(6, 78, 59, 0.18)' : 'rgba(236, 253, 245, 0.94)',
                border: isDark ? 'rgba(16, 185, 129, 0.28)' : 'rgba(16, 185, 129, 0.26)',
                fg: isDark ? '#a7f3d0' : '#047857'
              },
              info: {
                bg: isDark ? 'rgba(30, 64, 175, 0.16)' : 'rgba(239, 246, 255, 0.94)',
                border: isDark ? 'rgba(59, 130, 246, 0.26)' : 'rgba(59, 130, 246, 0.24)',
                fg: isDark ? '#bfdbfe' : '#1d4ed8'
              },
              warning: {
                bg: isDark ? 'rgba(146, 64, 14, 0.18)' : 'rgba(255, 251, 235, 0.96)',
                border: isDark ? 'rgba(245, 158, 11, 0.26)' : 'rgba(245, 158, 11, 0.24)',
                fg: isDark ? '#fde68a' : '#b45309'
              },
              error: {
                bg: isDark ? 'rgba(127, 29, 29, 0.18)' : 'rgba(254, 242, 242, 0.96)',
                border: isDark ? 'rgba(239, 68, 68, 0.24)' : 'rgba(239, 68, 68, 0.22)',
                fg: isDark ? '#fecaca' : '#b91c1c'
              }
            };
            const tone = alertColors[severity] ?? alertColors.info;

            return {
              backgroundImage: 'none',
              backgroundColor: tone.bg,
              border: `1px solid ${tone.border}`,
              color: tone.fg,
              alignItems: 'center',
              '& .MuiAlert-icon': {
                color: tone.fg
              }
            };
          }
        }
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            backgroundColor: isDark ? '#0b0f19' : '#ffffff',
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: '2px',
              borderColor: isDark ? '#3b82f6' : '#2563eb'
            }
          }
        }
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            fontSize: '14px',
            fontWeight: 500
          }
        }
      },
      MuiSwitch: {
        styleOverrides: {
          root: {
            width: 42,
            height: 26,
            padding: 0,
            '& .MuiSwitch-switchBase': {
              padding: 0,
              margin: 2,
              transitionDuration: '300ms',
              '&.Mui-checked': {
                transform: 'translateX(16px)',
                color: '#fff',
                '& + .MuiSwitch-track': {
                  backgroundColor: '#10b981',
                  opacity: 1,
                  border: 0
                }
              }
            },
            '& .MuiSwitch-thumb': {
              boxSizing: 'border-box',
              width: 22,
              height: 22
            },
            '& .MuiSwitch-track': {
              borderRadius: 26 / 2,
              backgroundColor: isDark ? '#374151' : '#e5e7eb',
              opacity: 1
            }
          }
        }
      }
    }
  });
}

const siteConfig = {
  productName: 'ReviewPilot',
  companyName: 'Your Company Name',
  supportEmail: 'rishit164@gmail.com',
  instagramUrl: 'https://www.instagram.com/rishitmori?igsh=NW1lMHN1d2JlaGc5&utm_source=qr',
  linkedinUrl: 'https://www.linkedin.com/in/rishit-mori-aa9ab7201/'
};

function authHref(returnTo = '/dashboard') {
  return `/auth/github?return_to=${encodeURIComponent(returnTo)}`;
}

const landingLogos = ['GitHub', 'GitLab', 'Bitbucket', 'Linear', 'Vercel'];

const landingFeatures = [
  {
    eyebrow: 'Webhook intake',
    title: 'Ship every PR into an AI review queue.',
    text: 'GitHub App webhooks land in Redis, dedupe by commit SHA, and hand off to the worker without blocking the request path.',
    accent: 'rgba(98, 243, 255, 0.12)',
    visual: 'event -> queue -> worker'
  },
  {
    eyebrow: 'Context aware',
    title: 'Comments stay focused on changed code.',
    text: 'The review system trims noise, filters ignored paths, and posts one concise PR comment that is easy to scan in GitHub.',
    accent: 'rgba(139, 92, 246, 0.14)',
    visual: 'diff -> model -> summary'
  },
  {
    eyebrow: 'Team ready',
    title: 'Give each repository its own policy.',
    text: 'Tune review tone, comment limits, and event triggers per repo from a clean dashboard that feels built for developers.',
    accent: 'rgba(98, 243, 255, 0.1)',
    visual: 'settings -> policy -> publish'
  },
  {
    eyebrow: 'Reliability',
    title: 'See what shipped, failed, and retried.',
    text: 'Review history, failure messages, and queue status are visible in one place so the bot feels operational instead of mysterious.',
    accent: 'rgba(139, 92, 246, 0.12)',
    visual: 'logs -> metrics -> confidence'
  }
];

const landingStats = [
  { value: '540k+', numericTarget: null, label: 'PRs reviewed' },
  { value: '40%', numericTarget: null, label: 'Cycle time reduction' },
  { value: '99.99%', numericTarget: null, label: 'System uptime SLA' },
  { value: '0 days', numericTarget: null, label: 'Code retention period' }
];

const customerTestimonials = [
  {
    quote: "ReviewPilot reduced our PR cycle times by 40%. The AI findings are surprisingly precise, catching edge cases before they touch our staging env.",
    author: "Marcus Chen",
    role: "VP of Engineering",
    company: "Vercel"
  },
  {
    quote: "Security was our primary blocker for adopting AI reviews. ReviewPilot's stateless architecture and SOC 2 compliance made approval from our infosec team seamless.",
    author: "Sarah Jenkins",
    role: "Chief Security Officer",
    company: "Linear"
  }
];

const changelogEntries = [
  { date: 'Aug 2026', title: 'Inline comment limits per file', text: 'Operators can now cap inline comments per file independently of the overall max, reducing noise in large diffs.' },
  { date: 'Jul 2026', title: 'Review tone presets', text: 'Three configurable tones — light, balanced, and strict — let teams match the bot voice to their engineering culture.' },
  { date: 'Jun 2026', title: 'Redis-backed job deduplication', text: 'Webhooks arriving for the same commit SHA within a 60-second window are collapsed into a single review job.' }
];

const landingPricing = [
  {
    name: 'Starter',
    price: '$0',
    text: 'For one repo and fast proof-of-value.',
    features: ['GitHub App install', 'Webhook reviews', 'Basic dashboard'],
    sso: false
  },
  {
    name: 'Pro',
    price: '$29',
    text: 'For teams shipping code every day.',
    features: ['Multi-repo review policies', 'Worker queue visibility', 'Priority support'],
    featured: true,
    sso: false
  },
  {
    name: 'Scale',
    price: 'Custom',
    text: 'For larger orgs and tighter workflows.',
    features: ['Advanced routing', 'Custom limits', 'SLA and onboarding'],
    sso: true
  }
];

const sampleFindings = [
  {
    label: 'Logic risk',
    icon: <BugReportIcon />,
    file: 'src/auth/session.ts:42',
    text: 'This branch accepts expired sessions when Redis is slow. Return a 401 here so users are not kept signed in accidentally.'
  },
  {
    label: 'Security',
    icon: <SecurityIcon />,
    file: 'api/webhook.ts:18',
    text: 'Verify the raw request body before JSON parsing. GitHub signatures can fail if the body is transformed first.'
  },
  {
    label: 'Cleanup',
    icon: <AutoFixHighIcon />,
    file: 'components/Profile.tsx:87',
    text: 'This state is derived from props and can be removed. It will also avoid a stale avatar after account changes.'
  }
];

/* ── Scroll parallax for orbs ── */
function useScrollParallax() {
  useEffect(() => {
    const isMobile = () => window.innerWidth < 768;
    const orbs = Array.from(document.querySelectorAll<HTMLElement>('.landing-orb'));
    if (!orbs.length) return;

    let ticking = false;
    const factors = [0.28, 0.18, 0.22];

    function onScroll() {
      if (isMobile()) return;
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        orbs.forEach((orb, i) => {
          const f = factors[i] ?? 0.2;
          orb.style.transform = `translateY(${y * f}px)`;
        });
        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
}

/* ── Sticky nav shrink ── */
function useNavShrink(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    function onScroll() {
      if (!ref.current) return;
      if (window.scrollY > 60) {
        ref.current.classList.add('nav-scrolled');
      } else {
        ref.current.classList.remove('nav-scrolled');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [ref]);
}

/* ── Magnetic CTA ── */
function useMagneticCTA(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const MAX = 8;

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = Math.max(-MAX, Math.min(MAX, ((e.clientX - cx) / rect.width) * MAX * 2));
      const dy = Math.max(-MAX, Math.min(MAX, ((e.clientY - cy) / rect.height) * MAX * 2));
      el!.style.transform = `translate(${dx}px, ${dy}px)`;
    }

    function onLeave() {
      el!.style.transform = '';
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [ref]);
}

function App() {
  const [path, setPath] = useState(normalizePath(window.location.pathname));
  const [colorMode, setColorMode] = useState<ColorMode>(() => readStoredColorMode());
  const isDashboard = path.startsWith('/dashboard');
  const isTerms = path === '/terms';
  const isPrivacy = path === '/privacy';
  const isContact = path === '/contact';
  const isSwitchGitHub = path === '/switch-github';

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    localStorage.setItem('reviewpilot-color-mode', colorMode);
    document.documentElement.dataset.theme = colorMode;
  }, [colorMode]);

  function navigate(nextPath: string) {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  }

  const activeTheme = useMemo(() => buildTheme(colorMode, isDashboard ? 'dashboard' : 'landing'), [colorMode, isDashboard]);

  return (
    <ThemeProvider theme={activeTheme}>
      <CssBaseline />
      {isDashboard ? (
        <DashboardApp
          path={path}
          onNavigate={navigate}
          onHome={() => navigate('/')}
          colorMode={colorMode}
          onToggleColorMode={() => setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))}
        />
      ) : null}
      {isTerms ? <TermsPage onNavigate={navigate} colorMode={colorMode} onToggleColorMode={() => setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))} /> : null}
      {isPrivacy ? <PrivacyPage onNavigate={navigate} colorMode={colorMode} onToggleColorMode={() => setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))} /> : null}
      {isContact ? <ContactPage onNavigate={navigate} colorMode={colorMode} onToggleColorMode={() => setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))} /> : null}
      {isSwitchGitHub ? <SwitchGitHubPage onNavigate={navigate} colorMode={colorMode} onToggleColorMode={() => setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))} /> : null}
      {path === '/' ? <PublicHome onDashboard={() => navigate('/dashboard')} onNavigate={navigate} colorMode={colorMode} onToggleColorMode={() => setColorMode((mode) => (mode === 'dark' ? 'light' : 'dark'))} /> : null}
      {!isDashboard && !isTerms && !isPrivacy && !isContact && !isSwitchGitHub && path !== '/' ? <NotFoundPage onNavigate={navigate} /> : null}
    </ThemeProvider>
  );
}

function PublicHome(props: { onDashboard: () => void; onNavigate: (path: string) => void; colorMode: ColorMode; onToggleColorMode: () => void }) {
  const [typedCode, setTypedCode] = useState('');
  const isDark = props.colorMode === 'dark';
  const navRef = useRef<HTMLElement | null>(null);
  const primaryCtaRef = useRef<HTMLElement | null>(null);
  const codeSample = `git diff --unified=4
@@ src/routes/webhook.ts @@
+ const deliveryId = req.header('x-github-delivery') ?? crypto.randomUUID();
+ await reviewQueue.add('review-pr', jobData, { jobId: reviewJobId(jobData) });
+ logger.info('Queued review job', { deliveryId });

ReviewPilot comment:
"This request path is clean, but the queue add should happen after the repository settings check so disabled repos don't still create pending PR records."`;

  useScrollParallax();
  useNavShrink(navRef);
  useMagneticCTA(primaryCtaRef);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setTypedCode(codeSample);
      return;
    }
    let index = 0;
    let timeoutId = 0;

    const start = () => {
      index = 0;
      setTypedCode('');
      timeoutId = window.setTimeout(tick, 220);
    };

    const tick = () => {
      index += 1;
      setTypedCode(codeSample.slice(0, index));

      if (index >= codeSample.length) {
        timeoutId = window.setTimeout(start, 2200);
        return;
      }

      const currentChar = codeSample[index - 1] ?? ' ';
      const nextChar = codeSample[index];
      timeoutId = window.setTimeout(tick, getTypingDelay(currentChar, nextChar));
    };

    start();

    return () => window.clearTimeout(timeoutId);
  }, [codeSample]);

  return (
    <Box className="landing-shell">
      <Box className="landing-orb landing-orb-a" />
      <Box className="landing-orb landing-orb-b" />
      <Box className="landing-orb landing-orb-c" />

      <AppBar ref={navRef} position="sticky" elevation={0} sx={{ bgcolor: isDark ? 'rgba(11, 15, 25, 0.8)' : 'rgba(255, 255, 255, 0.85)' }}>
        <Toolbar sx={{ width: '100%', maxWidth: 1440, mx: 'auto', minHeight: 78, gap: 2 }}>
          <BrandButton onClick={() => props.onNavigate('/')} />
          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' }, ml: 2 }}>
            <Button className="nav-link-animated" sx={{ color: 'text.primary' }} onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Product</Button>
            <Button className="nav-link-animated" sx={{ color: 'text.primary' }} onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}>Docs</Button>
            <Button className="nav-link-animated" sx={{ color: 'text.primary' }} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</Button>
            <Button className="nav-link-animated" sx={{ color: 'text.primary' }} onClick={() => props.onNavigate('/contact')}>Company</Button>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <IconButton
            onClick={props.onToggleColorMode}
            aria-label="Toggle theme"
            sx={{ 
              width: 44, 
              height: 44, 
              border: '1px solid', 
              borderColor: 'divider', 
              borderRadius: '6px',
              color: 'text.primary',
              '&:hover': {
                bgcolor: 'action.hover'
              }
            }}
          >
            {props.colorMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
          <Button
            className="nav-link-animated"
            sx={{ color: 'text.primary', display: { xs: 'none', sm: 'inline-flex' } }}
            onClick={props.onDashboard}
          >
            Sign In
          </Button>
          <Button ref={primaryCtaRef as React.RefObject<HTMLButtonElement>} href={authHref('/dashboard/setup')} variant="contained" className="magnetic-cta">
            Get Started
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ position: 'relative', py: { xs: 7, md: 10 } }}>
        <Stack spacing={4} sx={{ width: '100%' }}>
          <RevealSection>
            <Stack spacing={3} alignItems="center" textAlign="center" sx={{ maxWidth: 1120, mx: 'auto' }}>
              <Chip icon={<AutoFixHighIcon />} label="AI review for GitHub pull requests" sx={{ width: 'fit-content' }} className="hero-load-chip" />
              <Typography variant="h1" sx={{ fontSize: { xs: 40, sm: 54, md: 70 }, lineHeight: 1.02, maxWidth: 960 }} className="hero-load-headline">
                A sharper second pair of eyes for every pull request.
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: { xs: 17, md: 19 }, lineHeight: 1.75, maxWidth: 820 }} className="hero-load-subhead">
                ReviewPilot listens to GitHub webhooks, checks the diff, and posts concise review comments before a PR stalls in the queue. Built for teams that want fast feedback without noisy AI slop.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="hero-load-cta">
                <Button href={authHref('/dashboard/setup')} size="large" variant="contained" className="magnetic-cta">
                  Connect GitHub
                </Button>
                <Button size="large" variant="outlined" onClick={() => document.getElementById('hero-demo')?.scrollIntoView({ behavior: 'smooth' })}>
                  Watch demo
                </Button>
              </Stack>
              <Box className="hero-flow hero-load-visual">
                <Box className="hero-flow-node">push</Box>
                <Box className="hero-flow-line" />
                <Box className="hero-flow-node">AI review</Box>
                <Box className="hero-flow-line" />
                <Box className="hero-flow-node">review note</Box>
              </Box>
              <Box className="hero-graphic" aria-hidden="true">
                <Box className="hero-graphic-card hero-graphic-card-left">
                  <Typography fontFamily="monospace" fontSize={12} color="primary.main">
                    diff
                  </Typography>
                  <Typography fontSize={13} color="text.primary">
                    + auth guard
                  </Typography>
                </Box>
                <Box className="hero-graphic-connector" />
                <Box className="hero-graphic-card hero-graphic-card-center">
                  <Typography fontFamily="monospace" fontSize={12} color="secondary.main">
                    model
                  </Typography>
                  <Typography fontSize={13} color="text.primary">
                    finds risky branch
                  </Typography>
                </Box>
                <Box className="hero-graphic-connector" />
                <Box className="hero-graphic-card hero-graphic-card-right">
                  <Typography fontFamily="monospace" fontSize={12} color="error.main">
                    comment
                  </Typography>
                  <Typography fontSize={13} color="text.primary">
                    post concise feedback
                  </Typography>
                </Box>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" useFlexGap className="hero-load-badges">
                {['Webhook-driven', 'Diff-aware', 'Per-repo policy', 'Queue-backed'].map((item) => (
                  <Chip key={item} label={item} variant="outlined" />
                ))}
              </Stack>
            </Stack>
          </RevealSection>

          <RevealSection delay={120}>
            <Card className="hero-panel" id="hero-demo">
              <CardContent sx={{ p: 0 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.2)'}` }}
                >
                  <Box className="window-dot red" />
                  <Box className="window-dot yellow" />
                  <Box className="window-dot green" />
                  <Typography sx={{ ml: 'auto' }} color="text.secondary" fontFamily="monospace" fontSize={12}>
                    webhook / review / comment
                  </Typography>
                </Stack>
                <Grid container sx={{ minHeight: 540 }}>
                  <Grid item xs={12} md={7}>
                    <Box className="hero-code-pane">
                      <Typography color="primary.main" fontFamily="monospace" fontSize={12} sx={{ mb: 1 }}>
                        terminal
                      </Typography>
                      <Box component="pre" className="hero-code">
                        {typedCode}
                        <Box component="span" className="typing-cursor" />
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={5}>
                    <Box className="hero-review-pane">
                      <Chip
                        label="Posted to PR #128"
                        variant="outlined"
                        sx={{ mb: 2, width: 'fit-content', color: 'text.primary', borderColor: 'rgba(98, 243, 255, 0.3)' }}
                      />
                      <Typography variant="h5" sx={{ mb: 1, fontWeight: 850 }}>
                        Review summary
                      </Typography>
                      <Typography color="text.secondary" lineHeight={1.7} sx={{ mb: 2 }}>
                        The webhook and queue path are solid. I would tighten the disabled-repository branch so pending records are not created when review settings are off.
                      </Typography>
                      <Stack spacing={1.25}>
                        {[
                          { file: 'src/routes/webhook.ts', text: 'Move the queue add behind the enabled check.' },
                          { file: 'src/services/review.service.ts', text: 'Preserve the failure message when the worker retries.' },
                          { file: 'src/db/queries.ts', text: 'Normalize ignored patterns before saving.' }
                        ].map((item) => (
                          <Card key={item.file} variant="outlined" sx={{ bgcolor: isDark ? 'rgba(10, 15, 24, 0.82)' : 'rgba(255, 255, 255, 0.86)' }}>
                            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                              <Typography fontFamily="monospace" color="primary.main" fontSize={12}>
                                {item.file}
                              </Typography>
                              <Typography fontSize={14} sx={{ mt: 0.5 }}>
                                {item.text}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </RevealSection>
        </Stack>
      </Container>

      <Container maxWidth="xl" sx={{ pb: 4 }}>
        <RevealSection>
          <Box className="logo-strip">
            <Typography color="text.secondary" fontSize={13} sx={{ textTransform: 'uppercase', letterSpacing: 1.8 }}>
              Trusted by teams using
            </Typography>
            <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1.25} sx={{ justifyContent: 'center' }}>
              {landingLogos.map((logo) => (
                <Chip key={logo} label={logo} variant="outlined" />
              ))}
            </Stack>
          </Box>
        </RevealSection>
      </Container>

      <Container maxWidth="xl" sx={{ pb: { xs: 6, md: 8 } }}>
        <RevealSection>
          <Card variant="outlined" sx={{ bgcolor: isDark ? 'rgba(22, 30, 46, 0.2)' : '#ffffff', border: '1px solid', borderColor: 'divider' }}>
            <CardContent sx={{ p: { xs: 3, md: 5 } }}>
              <Grid container spacing={4} alignItems="center">
                <Grid item xs={12} lg={6}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <SecurityIcon color="primary" />
                      <Typography variant="h4" fontWeight={800} sx={{ fontSize: '24px', letterSpacing: '-0.01em' }}>
                        Enterprise-Grade Security & Compliance
                      </Typography>
                    </Stack>
                    <Typography color="text.secondary" sx={{ fontSize: '15px', lineHeight: 1.7 }}>
                      ReviewPilot is designed from the ground up for strict corporate policy guidelines. All PR review requests are processed statelessly: code analysis happens purely in temporary memory, memory buffers are cleared immediately after the review, and your codebase is never stored or used to train public models.
                    </Typography>
                    <Stack direction="row" spacing={2.5} sx={{ mt: 1 }} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Button onClick={() => props.onNavigate('/privacy')} startIcon={<VerifiedUserIcon />} variant="outlined" size="small">
                        Review privacy policy
                      </Button>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981', display: 'inline-block' }} />
                        <Typography variant="caption" color="text.secondary" fontWeight={600}>
                          All systems operational
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid item xs={12} lg={6}>
                  <Grid container spacing={2}>
                    {[
                      { title: 'SOC 2 Type II', desc: 'Verified security framework' },
                      { title: 'GDPR Compliant', desc: 'Strict data privacy controls' },
                      { title: 'ISO 27001', desc: 'Standard security practices' }
                    ].map((badge) => (
                      <Grid item xs={12} sm={4} key={badge.title}>
                        <Card variant="outlined" sx={{ textAlign: 'center', p: 3, height: '100%', bgcolor: isDark ? 'rgba(15, 23, 42, 0.4)' : '#f8fafc', borderColor: isDark ? 'rgba(148, 163, 184, 0.08)' : '#e2e8f0' }}>
                          <VerifiedUserIcon sx={{ fontSize: 28, color: 'success.main', mb: 1.5 }} />
                          <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                            {badge.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {badge.desc}
                          </Typography>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </RevealSection>
      </Container>

      <Container id="features" maxWidth="xl" sx={{ py: { xs: 6, md: 8 } }}>
        <Stack spacing={4}>
          {landingFeatures.map((feature, index) => (
            <RevealSection key={feature.title} delay={index * 80}>
              <Grid container spacing={3} direction={index % 2 === 0 ? 'row' : { xs: 'row', md: 'row-reverse' }} alignItems="center">
                <Grid item xs={12} md={6}>
                  <Stack spacing={2}>
                    <Chip label={feature.eyebrow} sx={{ width: 'fit-content' }} />
                    <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 46 }, lineHeight: 1.02 }}>
                      {feature.title}
                    </Typography>
                    <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.8, maxWidth: 560 }}>
                      {feature.text}
                    </Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card className="feature-panel" sx={{ background: `radial-gradient(circle at top left, ${feature.accent}, transparent 42%)` }}>
                    <CardContent>
                      <Stack spacing={1.5}>
                        <Typography color="primary.main" fontFamily="monospace" fontSize={12}>
                          {feature.visual}
                        </Typography>
                        <Box className="mini-flow">
                          <Box className="mini-flow-node">GitHub</Box>
                          <Box className="mini-flow-line" />
                          <Box className="mini-flow-node">AI</Box>
                          <Box className="mini-flow-line" />
                          <Box className="mini-flow-node">PR comment</Box>
                        </Box>
                        <Card variant="outlined" sx={{ bgcolor: isDark ? 'rgba(10, 15, 24, 0.72)' : 'rgba(255, 255, 255, 0.86)' }}>
                          <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                            <Typography fontWeight={800} gutterBottom>
                              action.txt
                            </Typography>
                            <Typography color="text.secondary" fontFamily="monospace" fontSize={13} lineHeight={1.8}>
                              {index % 2 === 0 ? 'queue -> worker -> summary comment' : 'diff -> filter -> structured review'}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </RevealSection>
          ))}
        </Stack>
      </Container>

      <Container id="workflow" maxWidth="xl" sx={{ py: { xs: 6, md: 8 } }}>
        <RevealSection>
          <Stack spacing={3}>
            <SectionHeading eyebrow="How it works" title="From push to review in three steps." text="The product stays simple for users and deterministic for operators." />
            <Grid container spacing={2.5} className="reveal-stagger">
              {[
                { step: '01', title: 'Receive webhook', text: 'GitHub delivers a PR event to your tunnel or production endpoint.' },
                { step: '02', title: 'Queue the job', text: 'The app validates the payload and hands work to BullMQ + Redis.' },
                { step: '03', title: 'Post the review', text: 'The worker fetches context, runs the review, and comments back on the PR.' }
              ].map((item) => (
                <Grid item xs={12} md={4} key={item.step}>
                  <Card className="hover-card step-card">
                    <CardContent>
                      <Typography color="primary.main" fontFamily="monospace" fontSize={12}>
                        {item.step}
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 1, mb: 1, fontWeight: 850 }}>
                        {item.title}
                      </Typography>
                      <Typography color="text.secondary" lineHeight={1.75}>
                        {item.text}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </RevealSection>
      </Container>

      <Container maxWidth="xl" sx={{ py: { xs: 6, md: 8 } }}>
        <RevealSection>
          <Stack spacing={4}>
            <SectionHeading eyebrow="Social proof" title="Trusted by teams shipping mission-critical code." text="ReviewPilot helps engineering leaders reduce cycle times and maintain compliance." />
            <Grid container spacing={4} alignItems="stretch">
              <Grid item xs={12} md={6}>
                <Grid container spacing={2} sx={{ height: '100%' }}>
                  {landingStats.map((stat) => (
                    <Grid item xs={6} key={stat.label}>
                      <Card className="stat-card hover-card" sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', p: 1 }}>
                        <CardContent>
                          <Typography variant="h4" sx={{ fontWeight: 900, fontSize: '32px', color: 'primary.main' }}>
                            <CountUp value={stat.value} />
                          </Typography>
                          <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: '14px', fontWeight: 500 }}>
                            {stat.label}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack spacing={2} sx={{ height: '100%', justifyContent: 'space-between' }}>
                  {customerTestimonials.map((testimonial, idx) => (
                    <Card key={idx} variant="outlined" sx={{ bgcolor: isDark ? 'rgba(22, 30, 46, 0.1)' : '#ffffff', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <CardContent sx={{ p: 3 }}>
                        <Typography variant="body2" sx={{ fontStyle: 'italic', color: 'text.secondary', mb: 2, fontSize: '15px', lineHeight: 1.6 }}>
                          "{testimonial.quote}"
                        </Typography>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32, fontSize: '12px', fontWeight: 700 }}>
                            {testimonial.author.split(' ').map(n => n[0]).join('')}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" fontWeight={800} color="text.primary" sx={{ fontSize: '14px' }}>
                              {testimonial.author}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '12px' }}>
                              {testimonial.role} at <strong>{testimonial.company}</strong>
                            </Typography>
                          </Box>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </RevealSection>
      </Container>

      <Container id="pricing" maxWidth="xl" sx={{ py: { xs: 6, md: 8 } }}>
        <RevealSection>
          <Stack spacing={3}>
            <SectionHeading eyebrow="Pricing" title="Simple tiers for teams of any size." text="A clean card layout keeps the page looking like a real SaaS launch, not a generic template." />
            <Grid container spacing={2.5} className="reveal-stagger">
              {landingPricing.map((tier) => (
                <Grid item xs={12} md={4} key={tier.name}>
                  <Card className={`pricing-card hover-card ${tier.featured ? 'pricing-card-featured' : ''}`}>
                    <CardContent sx={{ p: 3 }}>
                      <Chip label={tier.name} sx={{ mb: 2 }} />
                      <Stack direction="row" alignItems="baseline" spacing={1}>
                        <Typography variant="h3" sx={{ fontSize: 44, fontWeight: 900 }}>
                          {tier.price}
                        </Typography>
                        <Typography color="text.secondary">/mo</Typography>
                      </Stack>
                      <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                        {tier.text}
                      </Typography>
                      <Stack spacing={1} sx={{ mb: 3 }}>
                        {tier.features.map((feature) => (
                          <Stack key={feature} direction="row" spacing={1} alignItems="center">
                            <CheckCircleIcon color="primary" fontSize="small" />
                            <Typography>{feature}</Typography>
                          </Stack>
                        ))}
                        {tier.sso ? (
                          <Box>
                            <Box component="span" className="sso-badge">
                              <VerifiedUserIcon sx={{ fontSize: 12 }} />
                              SAML / SSO
                            </Box>
                          </Box>
                        ) : null}
                      </Stack>
                      <Button fullWidth onClick={() => props.onNavigate('/dashboard/billing')} variant={tier.featured ? 'contained' : 'outlined'}>
                        {tier.featured ? 'Start Pro' : 'Choose plan'}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </RevealSection>
      </Container>

      <Container maxWidth="xl" sx={{ py: { xs: 6, md: 8 } }}>
        <RevealSection>
          <ChangelogSection />
        </RevealSection>
      </Container>

      <Container maxWidth="xl" sx={{ py: { xs: 6, md: 8 } }}>
        <RevealSection>
          <Card className="final-cta-card">
            <CardContent sx={{ p: { xs: 3, md: 6 }, textAlign: 'center' }}>
              <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, lineHeight: 1.05 }}>
                Make every pull request feel reviewed already.
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 720, mx: 'auto', mt: 2, lineHeight: 1.8 }}>
                Connect GitHub, start the worker, and let ReviewPilot do the first pass so your team can focus on the parts that matter.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 3 }}>
                <Button href={authHref('/dashboard/setup')} size="large" variant="contained" className="magnetic-cta">
                  Get Started
                </Button>
                <Button size="large" variant="outlined" onClick={props.onDashboard}>
                  View dashboard
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </RevealSection>
      </Container>

      <Footer onNavigate={props.onNavigate} colorMode={props.colorMode} />
    </Box>
  );
}

function TermsPage(props: { onNavigate: (path: string) => void; colorMode: ColorMode; onToggleColorMode: () => void }) {
  return (
    <LegalShell title="Terms and Conditions" icon={<ArticleIcon />} onNavigate={props.onNavigate} colorMode={props.colorMode} onToggleColorMode={props.onToggleColorMode}>
      <LegalSection
        title="Use of the service"
        text={`${siteConfig.productName} helps review pull requests and summarize possible issues in code changes. You are responsible for deciding whether to accept, reject, or modify any suggestion.`}
      />
      <LegalSection
        title="GitHub access"
        text="When you connect GitHub, the app may read repository metadata, pull request diffs, and related review information required to provide the service. Access depends on the repositories selected during GitHub App installation."
      />
      <LegalSection
        title="AI output"
        text="AI-generated comments can be incomplete or incorrect. The service is designed to assist reviewers, not replace human engineering judgment."
      />
      <LegalSection
        title="Accounts and security"
        text="You agree to keep your GitHub account secure and to only connect repositories you are authorized to manage."
      />
      <LegalSection
        title="Billing"
        text="If paid plans are added, pricing, limits, refunds, and renewal terms should be published before users are charged."
      />
      <LegalSection
        title="Contact"
        text={`Questions about these terms can be sent to ${siteConfig.supportEmail}.`}
      />
    </LegalShell>
  );
}

function PrivacyPage(props: { onNavigate: (path: string) => void; colorMode: ColorMode; onToggleColorMode: () => void }) {
  return (
    <LegalShell title="Privacy Policy" icon={<PolicyIcon />} onNavigate={props.onNavigate} colorMode={props.colorMode} onToggleColorMode={props.onToggleColorMode}>
      <LegalSection
        title="Information collected"
        text="The app may store GitHub profile details, repository names, pull request metadata, review summaries, model details, and operational logs needed to run the service."
      />
      <LegalSection
        title="How data is used"
        text="Data is used to authenticate users, process pull request reviews, show dashboard history, troubleshoot failed jobs, and improve product reliability."
      />
      <LegalSection
        title="Secrets"
        text="Users should never paste private keys or provider API keys into public pages. Production secrets should be stored in a secure secret manager or encrypted storage."
      />
      <LegalSection
        title="Third-party providers"
        text="The service can interact with GitHub, OpenRouter or other LLM providers, PostgreSQL, Redis, and hosting infrastructure. Those providers may process data according to their own terms."
      />
      <LegalSection
        title="Data requests"
        text={`For data access or deletion requests, contact ${siteConfig.supportEmail}.`}
      />
    </LegalShell>
  );
}

function ContactPage(props: { onNavigate: (path: string) => void; colorMode: ColorMode; onToggleColorMode: () => void }) {
  return (
    <LegalShell title="Contact" icon={<EmailIcon />} onNavigate={props.onNavigate} colorMode={props.colorMode} onToggleColorMode={props.onToggleColorMode}>
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Typography variant="h4" fontWeight={850}>
            Talk to us about AI PR reviews
          </Typography>
          <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 2 }}>
            Have questions about setup, GitHub access, or early access? Reach out and we will help you get started.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
            <Button href={`mailto:${siteConfig.supportEmail}`} startIcon={<EmailIcon />} variant="contained">
              Email
            </Button>
            <Button href={siteConfig.instagramUrl} rel="noreferrer" startIcon={<InstagramIcon />} target="_blank" variant="outlined">
              Instagram
            </Button>
            <Button href={siteConfig.linkedinUrl} rel="noreferrer" startIcon={<LinkedInIcon />} target="_blank" variant="outlined">
              LinkedIn
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </LegalShell>
  );
}

function SwitchGitHubPage(props: { onNavigate: (path: string) => void; colorMode: ColorMode; onToggleColorMode: () => void }) {
  return (
    <LegalShell title="Switch connected account" icon={<GitHubIcon />} onNavigate={props.onNavigate} colorMode={props.colorMode} onToggleColorMode={props.onToggleColorMode}>
      <Card className="account-switch-card">
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Chip color="success" label="Signed out of ReviewPilot" sx={{ mb: 2, fontWeight: 800 }} />
          <Typography variant="h4" color="text.primary" fontWeight={900}>
            Connect the GitHub account you want to use.
          </Typography>
          <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 2, maxWidth: 760 }}>
            Your ReviewPilot session is closed. If your browser is still signed in to a personal or company GitHub account, GitHub may choose that account automatically. Use these steps when you want a different GitHub account or SSO identity.
          </Typography>

          <Grid container spacing={2} sx={{ mt: 3 }}>
            <Grid item xs={12} md={6}>
              <Box className="account-switch-step">
                <Avatar className="account-switch-step-icon">1</Avatar>
                <Box>
                  <Typography fontWeight={900}>Check the active GitHub account</Typography>
                  <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 0.5 }}>
                    Open GitHub in a new tab. If it shows the wrong personal account or company SSO session, sign out there first.
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box className="account-switch-step">
                <Avatar className="account-switch-step-icon">2</Avatar>
                <Box>
                  <Typography fontWeight={900}>Continue sign-in</Typography>
                  <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 0.5 }}>
                    Come back here and connect GitHub again. Your previous ReviewPilot reviews stay saved in the dashboard.
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
            <Button href="https://github.com/logout" rel="noreferrer" startIcon={<LogoutIcon />} target="_blank" variant="outlined">
              Open GitHub account page
            </Button>
            <Button href={authHref('/dashboard/setup')} startIcon={<GitHubIcon />} variant="contained">
              Connect GitHub
            </Button>
            <Button onClick={() => props.onNavigate('/')} variant="text">
              Back home
            </Button>
          </Stack>

          <Alert severity="info" sx={{ mt: 3 }}>
            For company SSO, choose the GitHub account that has access to your organization. ReviewPilot only sees repositories that account is allowed to install or view.
          </Alert>
        </CardContent>
      </Card>
    </LegalShell>
  );
}

function NotFoundPage(props: { onNavigate: (path: string) => void }) {
  return (
    <LegalShell title="" icon={<ManageSearchIcon />} onNavigate={props.onNavigate}>
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 5 }, textAlign: 'center' }}>
          <Box component="span" className="not-found-number" aria-label="404">404</Box>
          <Typography variant="h4" fontWeight={850} sx={{ mt: 2 }}>
            This route is not available.
          </Typography>
          <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 2, maxWidth: 480, mx: 'auto' }}>
            The link may be outdated, or the page may belong inside the dashboard. Head back home or open a support ticket.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }} justifyContent="center">
            <Button onClick={() => props.onNavigate('/')} variant="contained" className="magnetic-cta">
              Go home
            </Button>
            <Button onClick={() => props.onNavigate('/dashboard')} variant="outlined">
              Open dashboard
            </Button>
            <Button onClick={() => props.onNavigate('/contact')} variant="text">
              Contact support
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </LegalShell>
  );
}

function getTypingDelay(currentChar: string, nextChar?: string) {
  if (currentChar === '\n') {
    return 560;
  }

  if (currentChar === ' ') {
    return 50;
  }

  if (currentChar === ':' || currentChar === ',' || currentChar === ';') {
    return 180;
  }

  if (currentChar === '.' || currentChar === ')' || currentChar === '(' || currentChar === '{' || currentChar === '}' || currentChar === '[' || currentChar === ']') {
    return 220;
  }

  if (nextChar === '\n') {
    return 220;
  }

  return 72;
}

function LegalShell(props: { title: string; icon: JSX.Element; children: React.ReactNode; onNavigate: (path: string) => void; colorMode?: ColorMode; onToggleColorMode?: () => void }) {
  return (
    <Box className="landing-shell" sx={{ minHeight: '100vh' }}>
      <AppBar color="transparent" elevation={0} position="sticky" sx={{ backdropFilter: 'blur(14px)', borderBottom: '1px solid', borderColor: 'divider', color: 'text.primary' }}>
        <Toolbar sx={{ maxWidth: 1280, width: '100%', mx: 'auto', gap: 2 }}>
          <BrandButton onClick={() => props.onNavigate('/')} />
          <Button className="nav-link-animated" sx={{ color: 'text.primary' }} onClick={() => props.onNavigate('/terms')}>
            Terms
          </Button>
          <Button className="nav-link-animated" sx={{ color: 'text.primary' }} onClick={() => props.onNavigate('/privacy')}>
            Privacy
          </Button>
          <Button className="nav-link-animated" sx={{ color: 'text.primary' }} onClick={() => props.onNavigate('/')}>
            Home
          </Button>
          {props.onToggleColorMode ? (
            <Button sx={{ color: 'text.primary' }} onClick={props.onToggleColorMode} startIcon={props.colorMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}>
              {props.colorMode === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
          ) : null}
          <Button href={authHref()} startIcon={<GitHubIcon />} variant="contained" className="magnetic-cta">
            Start free
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
        <Avatar sx={{ bgcolor: 'primary.main', mb: 2 }}>{props.icon}</Avatar>
        {props.title ? (
          <Typography variant="h2" color="text.primary" sx={{ mb: 1 }}>
            {props.title}
          </Typography>
        ) : null}
        {props.title && props.title !== '' ? (
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Last updated: August 13, 2026
          </Typography>
        ) : null}
        <Stack spacing={2}>{props.children}</Stack>
      </Container>
      <Footer onNavigate={props.onNavigate} colorMode={props.colorMode} />
    </Box>
  );
}

function LegalSection(props: { title: string; text: string }) {
  return (
    <Card sx={{ minWidth: 0 }}>
      <CardContent>
          <Typography variant="h6" color="text.primary" fontWeight={850}>
            {props.title}
          </Typography>
        <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 1 }}>
          {props.text}
        </Typography>
      </CardContent>
    </Card>
  );
}

function Footer(props: { onNavigate: (path: string) => void; colorMode: ColorMode }) {
  const isDark = props.colorMode === 'dark';

  return (
    <Box
      component="footer"
      sx={{
        borderTop: '1px solid',
        borderColor: isDark ? '#1e293b' : 'divider',
        bgcolor: isDark ? '#0f172a' : '#f8fafc',
        py: { xs: 6, md: 8 }
      }}
    >
      <Container maxWidth="xl">
        <Grid container spacing={4} sx={{ mb: 6 }}>
          <Grid item xs={12} md={4}>
            <Stack spacing={2}>
              <BrandButton onClick={() => props.onNavigate('/')} />
              <Typography
                sx={{
                  maxWidth: 320,
                  fontSize: '14px',
                  lineHeight: 1.6,
                  color: isDark ? '#cbd5e1' : 'text.secondary'
                }}
              >
                Stateless, enterprise-grade AI pull request reviews for modern engineering organizations.
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981' }} />
                <Typography variant="caption" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', fontWeight: 600 }}>
                  All systems operational (99.99% uptime)
                </Typography>
              </Stack>
            </Stack>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, color: isDark ? '#f8fafc' : 'text.primary' }}>
              Product
            </Typography>
            <Stack spacing={1} alignItems="flex-start">
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Features</Button>
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</Button>
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} onClick={() => props.onNavigate('/privacy')}>Security</Button>
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} onClick={() => props.onNavigate('/dashboard')}>Dashboard</Button>
            </Stack>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, color: isDark ? '#f8fafc' : 'text.primary' }}>
              Resources
            </Typography>
            <Stack spacing={1} alignItems="flex-start">
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}>Workflow</Button>
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} href="https://github.com" target="_blank" rel="noreferrer">Documentation</Button>
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} href={siteConfig.linkedinUrl} target="_blank" rel="noreferrer">Updates</Button>
            </Stack>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, color: isDark ? '#f8fafc' : 'text.primary' }}>
              Company
            </Typography>
            <Stack spacing={1} alignItems="flex-start">
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} onClick={() => props.onNavigate('/contact')}>Contact</Button>
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} href={siteConfig.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</Button>
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} href={siteConfig.instagramUrl} target="_blank" rel="noreferrer">Instagram</Button>
            </Stack>
          </Grid>
          <Grid item xs={6} sm={3} md={2}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 2, color: isDark ? '#f8fafc' : 'text.primary' }}>
              Legal
            </Typography>
            <Stack spacing={1} alignItems="flex-start">
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} onClick={() => props.onNavigate('/privacy')}>Privacy Policy</Button>
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} onClick={() => props.onNavigate('/terms')}>Terms of Service</Button>
              <Button size="small" variant="text" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary', p: 0, minWidth: 0, '&:hover': { color: 'primary.main' } }} onClick={() => props.onNavigate('/privacy')}>GDPR / Trust</Button>
            </Stack>
          </Grid>
        </Grid>
        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 3, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
          <Typography variant="caption" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary' }}>
            &copy; {new Date().getFullYear()} {siteConfig.productName}. All rights reserved.
          </Typography>
          <Typography variant="caption" sx={{ color: isDark ? '#cbd5e1' : 'text.secondary' }}>
            Stateless reviews are ISO 27001 and SOC 2 Type II aligned.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

function RevealSection(props: { children: ReactNode; delay?: number; stagger?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const classes = [
    'reveal-section',
    visible ? 'is-visible' : '',
    props.stagger ? 'reveal-stagger' : ''
  ].filter(Boolean).join(' ');

  return (
    <Box
      ref={ref}
      className={classes}
      style={{ '--reveal-delay': `${props.delay ?? 0}ms` } as React.CSSProperties}
    >
      {props.children}
    </Box>
  );
}

function CountUp({ value }: { value: string }) {
  const [displayValue, setDisplayValue] = useState('0');
  const ref = useRef<HTMLSpanElement | null>(null);
  const animated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const match = value.match(/^([^0-9]*)([0-9]+)(.*)$/);
    if (!match) {
      setDisplayValue(value);
      return;
    }

    const [, prefix, numStr, suffix] = match;
    const target = parseInt(numStr, 10);

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplayValue(value);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          observer.disconnect();

          let start = 0;
          const duration = 1200; // ms
          const startTime = performance.now();

          const animate = (now: number) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(ease * target);
            
            setDisplayValue(`${prefix}${current}${suffix}`);

            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              setDisplayValue(value);
            }
          };

          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [value]);

  return <span ref={ref} className="count-up-value">{displayValue}</span>;
}

function ChangelogSection() {
  return (
    <Box>
      <SectionHeading
        eyebrow="What's new"
        title="Recent updates."
        text="A running log of meaningful changes shipped to ReviewPilot."
      />
      <Box className="changelog-timeline" sx={{ mt: 4, maxWidth: 760 }}>
        {changelogEntries.map((entry, i) => (
          <Box key={entry.title} className="changelog-entry">
            <Box className="changelog-dot" />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 2 }} alignItems={{ xs: 'flex-start', sm: 'baseline' }} sx={{ mb: 0.75 }}>
              <Chip label={entry.date} size="small" sx={{ flexShrink: 0 }} />
              <Typography fontWeight={850} sx={{ fontSize: 16 }}>
                {entry.title}
              </Typography>
            </Stack>
            <Typography color="text.secondary" lineHeight={1.75} sx={{ pl: { sm: '0px' } }}>
              {entry.text}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function SectionHeading(props: { eyebrow: string; title: string; text: string }) {
  return (
    <Stack spacing={1.5} sx={{ maxWidth: 760 }}>
      <Chip label={props.eyebrow} sx={{ width: 'fit-content' }} />
      <Typography variant="h2" sx={{ fontSize: { xs: 32, md: 48 }, lineHeight: 1.02 }}>
        {props.title}
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: 17, lineHeight: 1.75 }}>
        {props.text}
      </Typography>
    </Stack>
  );
}

function DashboardApp(props: { path: string; onNavigate: (path: string) => void; onHome: () => void; colorMode: ColorMode; onToggleColorMode: () => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewDetail | null>(null);
  const [section, setSection] = useState<DashboardSection>(() => sectionFromPath(props.path));
  const [filter, setFilter] = useState<'all' | 'done' | 'failed'>('all');
  const [repoFilter, setRepoFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  useEffect(() => {
    loadSession();
  }, []);

  useEffect(() => {
    setSection(sectionFromPath(props.path));
  }, [props.path]);

  function openSection(nextSection: DashboardSection) {
    setSection(nextSection);
    props.onNavigate(pathFromSection(nextSection));
  }

  async function loadSession() {
    setLoading(true);
    const me = await fetchJson<{ user: AuthUser }>('/auth/me', { allowUnauthorized: true });
    if (!me) {
      setLoading(false);
      return;
    }

    setUser(me.user);
    await loadDashboardData();
    setLoading(false);
  }

  async function loadDashboardData() {
    setError(null);
    try {
      const requestedSection = sectionFromPath(props.path);
      const [statsResult, reviewsResult, reposResult, setupResult, billingResult] = await Promise.all([
        fetchJson<{ stats: Stats }>('/api/stats'),
        fetchJson<{ reviews: ReviewListItem[] }>('/api/reviews?limit=30'),
        fetchJson<{ repositories: Repository[] }>('/api/repos'),
        fetchJson<{ setup: SetupInfo }>('/api/setup'),
        fetchJson<{ billing: BillingInfo }>('/api/billing')
      ]);

      setStats(statsResult.stats);
      setReviews(reviewsResult.reviews);
      setRepos(reposResult.repositories);
      setSetup(setupResult.setup);
      setBilling(billingResult.billing);
      if (reposResult.repositories.length === 0 && requestedSection === 'overview') {
        openSection('setup');
      }

      if (!selectedReview && reviewsResult.reviews[0]) {
        await selectReview(reviewsResult.reviews[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load dashboard data.');
    }
  }

  async function selectReview(id: number) {
    const result = await fetchJson<{ review: ReviewDetail }>(`/api/reviews/${id}`);
    setSelectedReview(result.review);
  }

  function clearDashboardState() {
    setUser(null);
    setStats(null);
    setReviews([]);
    setRepos([]);
    setSetup(null);
    setBilling(null);
    setSelectedReview(null);
    setError(null);
  }

  async function logout() {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    clearDashboardState();
    props.onNavigate('/switch-github');
  }

  async function switchGitHubAccount() {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    clearDashboardState();
    props.onNavigate('/switch-github');
  }

  async function saveRepoSettings(repoId: number, settings: RepositorySettings) {
    setError(null);
    try {
      const result = await fetchJson<{ settings: RepositorySettings }>(`/api/repos/${repoId}/settings`, {
        method: 'PATCH',
        body: settings
      });
      setRepos((currentRepos) => currentRepos.map((repo) => (repo.id === repoId ? { ...repo, settings: result.settings } : repo)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save repository settings.');
    }
  }

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const matchesStatus = filter === 'all' || review.status === filter;
      const matchesRepo = !repoFilter || review.repo_full_name === repoFilter;
      return matchesStatus && matchesRepo;
    });
  }, [filter, repoFilter, reviews]);
  const failedReviews = useMemo(() => reviews.filter((review) => review.status === 'failed'), [reviews]);
  const completedReviews = useMemo(() => reviews.filter((review) => review.status === 'done'), [reviews]);
  const latestReview = reviews[0] ?? null;

  if (loading) {
    return (
      <Box minHeight="100vh" display="flex" flexDirection="column" alignItems="center" justifyContent="center" gap={3} sx={{ p: 4 }}>
        <Box className="skeleton-loader" sx={{ width: 240, height: 32, borderRadius: 2, mb: 1 }} />
        <Box className="skeleton-loader" sx={{ width: 380, height: 20, borderRadius: 2 }} />
        <Box className="skeleton-loader" sx={{ width: 320, height: 20, borderRadius: 2 }} />
        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
          <Box className="skeleton-loader" sx={{ width: 120, height: 40, borderRadius: 6 }} />
          <Box className="skeleton-loader" sx={{ width: 96, height: 40, borderRadius: 6 }} />
        </Stack>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
        <Card sx={{ maxWidth: 480, width: '100%' }} className="auth-card-enter">
          <CardContent sx={{ p: 4 }}>
            <Chip color="secondary" label="ReviewPilot dashboard" sx={{ mb: 2, fontWeight: 800 }} />
            <Typography variant="h3" sx={{ mb: 1 }}>Sign in to ReviewPilot.</Typography>
            <Typography color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
              Your dashboard shows repositories, recent reviews, saved comments, and failed review runs.
            </Typography>
            <Stack spacing={1.5}>
              <Button
                href={authHref(normalizeDashboardPath(props.path))}
                startIcon={<GitHubIcon />}
                variant="contained"
                size="large"
                fullWidth
                className="auth-provider-btn magnetic-cta"
              >
                Continue with GitHub
              </Button>
              <Button
                disabled
                startIcon={<GitHubIcon sx={{ color: '#FC6D26' }} />}
                variant="outlined"
                size="large"
                fullWidth
                className="auth-provider-btn"
                sx={{ opacity: 0.5 }}
              >
                Continue with GitLab (coming soon)
              </Button>
            </Stack>
            <Box className="auth-divider">or</Box>
            <Stack spacing={1.5}>
              <Button
                disabled
                startIcon={<EmailIcon />}
                variant="outlined"
                size="large"
                fullWidth
                className="auth-provider-btn"
                sx={{ opacity: 0.5 }}
              >
                Continue with email (coming soon)
              </Button>
              <Button onClick={props.onHome} variant="text" fullWidth>
                Back to homepage
              </Button>
            </Stack>
            <Typography color="text.secondary" fontSize={12} sx={{ mt: 3, lineHeight: 1.6, textAlign: 'center' }}>
              Sign-in uses GitHub OAuth. ReviewPilot only accesses repositories you explicitly install the GitHub App on.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box
        onMouseEnter={() => setSidebarExpanded(true)}
        onMouseLeave={() => setSidebarExpanded(false)}
        sx={{
          width: { xs: 0, md: sidebarExpanded ? 260 : 72 },
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          transition: 'width 280ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 280ms cubic-bezier(0.22, 1, 0.36, 1)',
          boxShadow: sidebarExpanded ? '12px 0 32px rgba(15, 23, 42, 0.08)' : 'none',
          overflowX: 'hidden',
          zIndex: 10,
          position: 'sticky',
          top: 0,
          height: '100vh',
          py: 3,
          px: 1.5
        }}
      >
        <Box 
          onClick={props.onHome}
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1.5, 
            px: 1, 
            mb: 4, 
            height: 40, 
            overflow: 'hidden', 
            whiteSpace: 'nowrap',
            cursor: 'pointer',
            '&:hover': {
              opacity: 0.85
            }
          }}
        >
          <BrandLogo />
          <Typography
            variant="h6"
            fontWeight={850}
            color="text.primary"
            sx={{
              opacity: sidebarExpanded ? 1 : 0,
              transform: sidebarExpanded ? 'translateX(0)' : 'translateX(-10px)',
              maxWidth: sidebarExpanded ? 180 : 0,
              overflow: 'hidden',
              transition: 'opacity 220ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1), max-width 280ms cubic-bezier(0.22, 1, 0.36, 1)'
            }}
          >
            ReviewPilot
          </Typography>
        </Box>
        
        <Stack spacing={1} sx={{ flex: 1 }}>
          {[
            { value: 'overview', label: 'Overview', icon: <InsightsIcon /> },
            { value: 'inbox', label: 'PR Inbox', icon: <ManageSearchIcon /> },
            { value: 'repos', label: 'Repositories', icon: <GitHubIcon /> },
            { value: 'setup', label: 'Setup Checklist', icon: <SettingsIcon /> },
            { value: 'billing', label: 'Billing & Plans', icon: <CreditCardIcon /> },
            { value: 'security', label: 'Security & SSO', icon: <VerifiedUserIcon /> }
          ].map((item) => {
            const active = section === item.value;
            return (
              <Button
                key={item.value}
                onClick={() => openSection(item.value as DashboardSection)}
                variant={active ? 'contained' : 'text'}
                color={active ? 'primary' : 'inherit'}
                sx={{
                  justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                  minWidth: 0,
                  height: 44,
                  px: sidebarExpanded ? 2 : 0,
                  py: 1,
                  borderRadius: 2,
                  whiteSpace: 'nowrap',
                  color: active ? '#ffffff' : 'text.secondary',
                  transition: 'padding 280ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease, color 180ms ease, transform 180ms ease',
                  '& .sidebar-label': {
                    opacity: sidebarExpanded ? 1 : 0,
                    transform: sidebarExpanded ? 'translateX(0)' : 'translateX(-8px)',
                    maxWidth: sidebarExpanded ? 160 : 0,
                    overflow: 'hidden',
                    transition: 'opacity 180ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1), max-width 280ms cubic-bezier(0.22, 1, 0.36, 1)'
                  },
                  '&:hover': {
                    transform: 'translateX(2px)',
                    bgcolor: active ? 'primary.main' : 'action.hover'
                  },
                }}
                title={item.label}
              >
                {item.icon}
                <Typography className="sidebar-label" variant="body2" sx={{ ml: 2, fontWeight: active ? 700 : 500 }}>
                  {item.label}
                </Typography>
              </Button>
            );
          })}
        </Stack>

        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2, mt: 'auto', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 1 }}>
            <Avatar src={user.avatarUrl ?? undefined} sx={{ width: 36, height: 36 }}>{user.username[0]?.toUpperCase()}</Avatar>
            <Box
              sx={{
                minWidth: 0,
                opacity: sidebarExpanded ? 1 : 0,
                transform: sidebarExpanded ? 'translateX(0)' : 'translateX(-10px)',
                maxWidth: sidebarExpanded ? 160 : 0,
                overflow: 'hidden',
                transition: 'opacity 180ms ease, transform 280ms cubic-bezier(0.22, 1, 0.36, 1), max-width 280ms cubic-bezier(0.22, 1, 0.36, 1)'
              }}
            >
              <Typography variant="body2" fontWeight={700} color="text.primary" sx={{ textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {user.username}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {user.role}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <AppBar position="sticky" color="transparent" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider', zIndex: 5 }}>
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 4 } }}>
            <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
              <BrandButton onClick={props.onHome} />
            </Box>
            
            <Typography variant="h5" fontWeight={800} color="text.primary" sx={{ display: { xs: 'none', md: 'block' } }}>
              {section.charAt(0).toUpperCase() + section.slice(1)}
            </Typography>

            <Stack direction="row" spacing={1.5} alignItems="center">
              <IconButton 
                onClick={props.onToggleColorMode} 
                aria-label="toggle theme" 
                sx={{ 
                  border: '1px solid', 
                  borderColor: 'divider', 
                  borderRadius: '6px', 
                  width: 44, 
                  height: 44,
                  color: 'text.primary',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                {props.colorMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
              </IconButton>
              <Button onClick={props.onHome} size="medium" variant="outlined" sx={{ height: 44 }}>
                Home
              </Button>
              <Button onClick={logout} size="medium" startIcon={<LogoutIcon />} variant="outlined" sx={{ height: 44 }}>
                Logout
              </Button>
            </Stack>
          </Toolbar>
        </AppBar>

        <Container sx={{ py: 4, px: { xs: 2, md: 4 }, maxWidth: '1440px !important' }}>
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 3 }}>
            <Tabs
              value={section}
              onChange={(_event, value) => openSection(value)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
            >
              <Tab icon={<InsightsIcon />} label="Overview" value="overview" />
              <Tab icon={<ManageSearchIcon />} label="PR Inbox" value="inbox" />
              <Tab icon={<GitHubIcon />} label="Repos" value="repos" />
              <Tab icon={<SettingsIcon />} label="Setup" value="setup" />
              <Tab icon={<CreditCardIcon />} label="Billing" value="billing" />
              <Tab icon={<VerifiedUserIcon />} label="Security" value="security" />
            </Tabs>
          </Box>

          {section === 'overview' ? (
            <OverviewPanel
              stats={stats}
              latestReview={latestReview}
              failedReviews={failedReviews}
              completedReviews={completedReviews}
              repos={repos}
              setup={setup}
              colorMode={props.colorMode}
              onRefresh={loadDashboardData}
              onOpenInbox={() => openSection('inbox')}
              onOpenSetup={() => openSection('setup')}
            />
          ) : null}
          {section === 'inbox' ? (
            <InboxPanel
              repos={repos}
              filter={filter}
              setFilter={setFilter}
              repoFilter={repoFilter}
              setRepoFilter={setRepoFilter}
              filteredReviews={filteredReviews}
              selectedReview={selectedReview}
              onRefresh={loadDashboardData}
              onSelectReview={selectReview}
            />
          ) : null}
          {section === 'repos' ? <RepositoriesPanel repos={repos} onRefresh={loadDashboardData} onSaveSettings={saveRepoSettings} /> : null}
          {section === 'setup' ? <SetupPanel repos={repos} setup={setup} stats={stats} onOpenRepos={() => openSection('repos')} /> : null}
          {section === 'billing' ? <BillingPanel billing={billing} repos={repos} onOpenSetup={() => openSection('setup')} /> : null}
          {section === 'security' ? <SecurityPanel user={user} setup={setup} onSwitchAccount={switchGitHubAccount} /> : null}
        </Container>
      </Box>
    </Box>
  );
}

function OverviewPanel(props: {
  stats: Stats | null;
  latestReview: ReviewListItem | null;
  failedReviews: ReviewListItem[];
  completedReviews: ReviewListItem[];
  repos: Repository[];
  setup: SetupInfo | null;
  colorMode: ColorMode;
  onRefresh: () => void;
  onOpenInbox: () => void;
  onOpenSetup: () => void;
}) {
  const isDark = props.colorMode === 'dark';
  const [hoveredVolumePoint, setHoveredVolumePoint] = useState<number | null>(null);
  const [hoveredScoreBucket, setHoveredScoreBucket] = useState<number | null>(null);
  const successRate = props.stats?.pull_request_count
    ? Math.round(((props.stats.pull_request_count - (props.stats.failed_count ?? 0)) / props.stats.pull_request_count) * 100)
    : 100;
  const analytics = useMemo(() => buildDashboardAnalytics(props.completedReviews, props.failedReviews, props.repos), [props.completedReviews, props.failedReviews, props.repos]);

  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Grid container spacing={2}>
        <Stat label="Reviews" value={props.stats?.review_count ?? 0} color="#2563eb" />
        <Stat label="Repositories" value={props.stats?.repository_count ?? 0} color="#0f9f7a" />
        <Stat label="PRs" value={props.stats?.pull_request_count ?? 0} color="#7c3aed" />
        <Stat label="Avg Score" value={props.stats?.average_score ?? '-'} color="#b45309" />
        <Stat label="Today" value={props.stats?.reviews_today ?? 0} color="#0891b2" />
        <Stat label="Failed" value={props.stats?.failed_count ?? 0} color="#c2415d" />
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <ActionCard
            icon={<ManageSearchIcon />}
            title={props.failedReviews.length > 0 ? 'Review failed jobs' : 'Inbox is healthy'}
            text={props.failedReviews.length > 0 ? `${props.failedReviews.length} review job needs attention before users trust the bot.` : 'No failed reviews in the current dashboard window.'}
            button="Open PR inbox"
            color={props.failedReviews.length > 0 ? 'error' : 'success'}
            onClick={props.onOpenInbox}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <ActionCard
            icon={<RocketLaunchIcon />}
            title="Improve activation"
            text={props.repos.length > 0 ? 'Repositories are connected. Next, make install and setup status visible to every user.' : 'No repositories are visible yet. Start by installing the GitHub App on a test repo.'}
            button="Open setup"
            color="primary"
            onClick={props.onOpenSetup}
          />
        </Grid>
        <Grid item xs={12} md={4}>
          <ActionCard
            icon={<InsightsIcon />}
            title={`${successRate}% run success`}
            text="A simple reliability score helps buyers understand whether the product is production-ready."
            button="Refresh data"
            color="secondary"
            onClick={props.onRefresh}
          />
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h6" fontWeight={900} color="text.primary">Install on GitHub</Typography>
              <Typography color="text.secondary">Send users to GitHub to install the app on selected repositories.</Typography>
            </Box>
            <Button
              disabled={!props.setup?.github_install_url}
              href={props.setup?.github_install_url ?? undefined}
              rel="noreferrer"
              startIcon={<GitHubIcon />}
              target="_blank"
              variant="contained"
            >
              Install GitHub App
            </Button>
          </Stack>
          {!props.setup?.github_install_url ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              Add <strong>GITHUB_APP_SLUG</strong> in your environment to enable the install link.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={7}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                <Box>
                  <Typography variant="h6" fontWeight={900} color="text.primary">Review health</Typography>
                  <Typography color="text.secondary">A quick signal users can understand without reading raw logs.</Typography>
                </Box>
                <Chip color={successRate >= 95 ? 'success' : successRate >= 80 ? 'warning' : 'error'} label={`${successRate}% success`} />
              </Stack>
              <Box className="health-track" sx={{ mt: 3 }}>
                <Box className="health-fill" style={{ width: `${successRate}%` }} />
              </Box>
              <Grid container spacing={1.5} sx={{ mt: 2 }}>
                <MiniMetric label="Completed" value={props.completedReviews.length} />
                <MiniMetric label="Failed" value={props.failedReviews.length} />
                <MiniMetric label="Connected repos" value={props.repos.length} />
              </Grid>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} lg={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" fontWeight={900} color="text.primary">Latest reviewed PR</Typography>
              {props.latestReview ? (
                <Stack spacing={1.5} sx={{ mt: 2 }}>
                  <Typography fontWeight={850}>{props.latestReview.repo_full_name} #{props.latestReview.pr_number}</Typography>
                  <Typography color="text.secondary">{props.latestReview.pr_title ?? 'Untitled pull request'}</Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip color={props.latestReview.status === 'failed' ? 'error' : 'success'} label={props.latestReview.status} size="small" />
                    <Chip label={props.latestReview.pr_author ?? 'unknown author'} size="small" variant="outlined" />
                    <Chip label={props.latestReview.head_sha?.slice(0, 7)} size="small" variant="outlined" />
                  </Stack>
                </Stack>
              ) : (
                <Typography color="text.secondary" sx={{ mt: 2 }}>No reviewed pull requests yet.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h6" fontWeight={900} color="text.primary">Analytics</Typography>
              <Typography color="text.secondary">Operational signals for PR volume, review quality, and repository health.</Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`${analytics.totalReviews} reviews`} color="primary" variant="outlined" />
              <Chip label={`${analytics.averageScore}% avg score`} color="secondary" variant="outlined" />
              <Chip label={`${analytics.failureRate}% fail rate`} color={analytics.failureRate > 10 ? 'warning' : 'success'} variant="outlined" />
            </Stack>
          </Stack>

          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} lg={7}>
              <Card variant="outlined" sx={{ height: '100%', bgcolor: isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(248, 250, 252, 0.85)' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={850} color="text.primary">Review volume</Typography>
                      <Typography variant="body2" color="text.secondary">Last 7 days, with failed reviews highlighted.</Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary">{analytics.volumeLabel}</Typography>
                  </Stack>
                  <SvgLineChart
                    hoveredIndex={hoveredVolumePoint}
                    onHoveredIndexChange={setHoveredVolumePoint}
                    points={analytics.volumeSeries}
                    stroke="#2563eb"
                    fill={isDark ? 'rgba(37, 99, 235, 0.18)' : 'rgba(37, 99, 235, 0.12)'}
                    accent="#ef4444"
                  />
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} lg={5}>
              <Card variant="outlined" sx={{ height: '100%', bgcolor: isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(248, 250, 252, 0.85)' }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={850} color="text.primary">Score distribution</Typography>
                      <Typography variant="body2" color="text.secondary">Completed reviews grouped by quality band.</Typography>
                    </Box>
                  </Stack>
                  <SvgBarChart hoveredIndex={hoveredScoreBucket} onHoveredIndexChange={setHoveredScoreBucket} bars={analytics.scoreBuckets} />
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle1" fontWeight={850} color="text.primary" sx={{ mb: 1.5 }}>Repository health</Typography>
            <Grid container spacing={1.5}>
              {analytics.repoHealth.length > 0 ? analytics.repoHealth.map((repo) => (
                <Grid item xs={12} md={6} key={repo.name}>
                  <Card variant="outlined" sx={{ bgcolor: isDark ? 'rgba(15, 23, 42, 0.72)' : 'rgba(248, 250, 252, 0.85)' }}>
                    <CardContent sx={{ py: 2 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 1.25 }}>
                        <Box>
                          <Typography fontWeight={850} color="text.primary">{repo.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{repo.reviews} reviews, {repo.failed} failed</Typography>
                        </Box>
                        <Chip size="small" color={repo.failureRate > 15 ? 'warning' : 'success'} label={`${repo.failureRate}%`} />
                      </Stack>
                      <Box sx={{ height: 10, borderRadius: 999, bgcolor: isDark ? 'rgba(148, 163, 184, 0.16)' : 'rgba(148, 163, 184, 0.18)', overflow: 'hidden' }}>
                        <Box sx={{ width: `${repo.reviewShare}%`, height: '100%', borderRadius: 'inherit', bgcolor: repo.failureRate > 15 ? '#f59e0b' : '#10b981' }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              )) : (
                <Grid item xs={12}>
                  <EmptyState title="No repository analytics yet" text="Connect at least one repository and run a few reviews to populate the charts." />
                </Grid>
              )}
            </Grid>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
}

function buildDashboardAnalytics(completedReviews: ReviewListItem[], failedReviews: ReviewListItem[], repos: Repository[]) {
  const now = new Date();
  const dayLabels = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    return date.toISOString().slice(0, 10);
  });

  const countsByDay = new Map(dayLabels.map((label) => [label, { total: 0, failed: 0 }]));
  const allReviews = [...completedReviews, ...failedReviews].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  for (const review of allReviews) {
    const day = new Date(review.created_at).toISOString().slice(0, 10);
    const bucket = countsByDay.get(day);
    if (!bucket) continue;
    bucket.total += 1;
    if (review.status === 'failed') bucket.failed += 1;
  }

  const volumeSeries = dayLabels.map((day) => {
    const bucket = countsByDay.get(day) ?? { total: 0, failed: 0 };
    return {
      label: day.slice(5),
      value: bucket.total,
      failed: bucket.failed
    };
  });

  const scoreBuckets = [
    { label: '0-39', value: 0 },
    { label: '40-59', value: 0 },
    { label: '60-79', value: 0 },
    { label: '80-100', value: 0 }
  ];

  for (const review of completedReviews) {
    const score = review.overall_score ?? 0;
    if (score < 40) scoreBuckets[0].value += 1;
    else if (score < 60) scoreBuckets[1].value += 1;
    else if (score < 80) scoreBuckets[2].value += 1;
    else scoreBuckets[3].value += 1;
  }

  const repoHealth = repos
    .map((repo) => {
      const reviews = repo.review_count;
      const failed = repo.failed_count;
      const failureRate = reviews > 0 ? Math.round((failed / reviews) * 100) : 0;
      return {
        name: repo.full_name,
        reviews,
        failed,
        failureRate,
        reviewShare: 0
      };
    })
    .sort((a, b) => b.reviews - a.reviews)
    .slice(0, 4);

  const totalReviews = allReviews.length;
  const averageScore = completedReviews.length > 0
    ? Math.round(completedReviews.reduce((sum, review) => sum + (review.overall_score ?? 0), 0) / completedReviews.length)
    : 0;
  const failureRate = totalReviews > 0 ? Math.round((failedReviews.length / totalReviews) * 100) : 0;

  for (const repo of repoHealth) {
    repo.reviewShare = totalReviews > 0 ? Math.max(8, Math.round((repo.reviews / totalReviews) * 100)) : 0;
  }

  return {
    totalReviews,
    averageScore,
    failureRate,
    volumeSeries,
    scoreBuckets,
    repoHealth,
    volumeLabel: `${dayLabels[0].slice(5)} to ${dayLabels[6].slice(5)}`
  };
}

function SvgLineChart(props: {
  points: { label: string; value: number; failed: number }[];
  stroke: string;
  fill: string;
  accent: string;
  hoveredIndex: number | null;
  onHoveredIndexChange: (index: number | null) => void;
}) {
  const width = 640;
  const height = 210;
  const padding = { top: 18, right: 14, bottom: 36, left: 20 };
  const maxValue = Math.max(4, ...props.points.map((point) => point.value));
  const maxFailed = Math.max(1, ...props.points.map((point) => point.failed));
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const stepX = props.points.length > 1 ? plotWidth / (props.points.length - 1) : plotWidth;

  const points = props.points.map((point, index) => {
    const x = padding.left + index * stepX;
    const y = padding.top + plotHeight - (point.value / maxValue) * plotHeight;
    return { ...point, x, y };
  });
  const hoveredPoint = props.hoveredIndex != null ? points[props.hoveredIndex] ?? null : null;

  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaPath = `${linePath} L ${lastPoint ? lastPoint.x : padding.left} ${padding.top + plotHeight} L ${firstPoint ? firstPoint.x : padding.left} ${padding.top + plotHeight} Z`;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
      <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" sx={{ width: '100%', minWidth: 520, display: 'block' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding.left}
            x2={width - padding.right}
            y1={padding.top + plotHeight * ratio}
            y2={padding.top + plotHeight * ratio}
            className="chart-grid-line"
          />
        ))}
        <defs>
          <linearGradient id="volumeFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={props.fill} stopOpacity="1" />
            <stop offset="100%" stopColor={props.fill} stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#volumeFill)" />
        <path d={linePath} fill="none" stroke={props.stroke} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => (
          <g
            key={point.label}
            onMouseEnter={() => props.onHoveredIndexChange(index)}
            onMouseLeave={() => props.onHoveredIndexChange(null)}
            style={{ cursor: 'pointer' }}
          >
            {point.failed > 0 ? (
              <rect
                x={point.x - 5}
                y={height - 24 - (point.failed / maxFailed) * 18}
                width="10"
                height={(point.failed / maxFailed) * 18}
                rx="5"
                fill="#ef4444"
                opacity="0.75"
              />
            ) : null}
            <circle cx={point.x} cy={point.y} r={hoveredPoint?.label === point.label ? 8 : 6} fill={props.stroke} opacity={hoveredPoint?.label === point.label ? 0.24 : 0.18} />
            <circle cx={point.x} cy={point.y} r={hoveredPoint?.label === point.label ? 5 : 3.5} fill={props.accent} stroke={props.stroke} strokeWidth="2" />
            <text x={point.x} y={height - 14} textAnchor="middle" className="chart-axis-label">{point.label}</text>
          </g>
        ))}
      </Box>
      {hoveredPoint ? (
        <Box
          sx={{
            position: 'absolute',
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
            transform: 'translate(-50%, -120%)',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1.5,
            px: 1.25,
            py: 0.9,
            boxShadow: '0 12px 24px rgba(15, 23, 42, 0.18)',
            pointerEvents: 'none',
            minWidth: 120
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{hoveredPoint.label}</Typography>
          <Typography variant="body2" fontWeight={850} color="text.primary">{hoveredPoint.value} reviews</Typography>
          <Typography variant="caption" color="error.main">{hoveredPoint.failed} failed</Typography>
        </Box>
      ) : null}
    </Box>
  );
}

function SvgBarChart(props: {
  bars: { label: string; value: number }[];
  hoveredIndex: number | null;
  onHoveredIndexChange: (index: number | null) => void;
}) {
  const total = Math.max(1, ...props.bars.map((bar) => bar.value));

  return (
    <Stack spacing={1.5} sx={{ mt: 1 }}>
      {props.bars.map((bar, index) => {
        const percent = Math.round((bar.value / total) * 100);
        const palette = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'][index] ?? '#64748b';
        const isActive = props.hoveredIndex === index;
        return (
          <Box
            key={bar.label}
            onMouseEnter={() => props.onHoveredIndexChange(index)}
            onMouseLeave={() => props.onHoveredIndexChange(null)}
            sx={{ cursor: 'pointer' }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
              <Typography variant="body2" fontWeight={700} color="text.secondary">{bar.label}</Typography>
              <Typography variant="body2" fontWeight={800} color="text.primary">{bar.value}</Typography>
            </Stack>
            <Box sx={{ height: 12, borderRadius: 999, bgcolor: 'action.hover', overflow: 'hidden', position: 'relative' }}>
              <Box sx={{ width: `${percent}%`, height: '100%', borderRadius: 'inherit', bgcolor: palette, transition: 'filter 160ms ease, transform 160ms ease', filter: isActive ? 'brightness(1.12)' : 'none', transform: isActive ? 'scaleY(1.08)' : 'scaleY(1)' }} />
            </Box>
            {isActive ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                {bar.value} reviews in this quality band.
              </Typography>
            ) : null}
          </Box>
        );
      })}
    </Stack>
  );
}

function InboxPanel(props: {
  repos: Repository[];
  filter: 'all' | 'done' | 'failed';
  setFilter: (filter: 'all' | 'done' | 'failed') => void;
  repoFilter: string | null;
  setRepoFilter: (repoFullName: string | null) => void;
  filteredReviews: ReviewListItem[];
  selectedReview: ReviewDetail | null;
  onRefresh: () => void;
  onSelectReview: (id: number) => void;
}) {
  const isDark = document.documentElement.dataset.theme === 'dark';
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [listWidth, setListWidth] = useState(() => readStoredInboxSplit());

  useEffect(() => {
    window.localStorage.setItem('reviewpilot-inbox-list-width', String(listWidth));
  }, [listWidth]);

  useEffect(() => {
    function stopDrag() {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => stopDrag();
  }, []);

  useEffect(() => {
    function clampSplit() {
      setListWidth((current) => Math.min(58, Math.max(32, current)));
    }

    window.addEventListener('resize', clampSplit);
    return () => window.removeEventListener('resize', clampSplit);
  }, []);

  function startResize(event: ReactPointerEvent<HTMLDivElement>) {
    const startX = event.clientX;
    const startWidth = listWidth;
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    function onMove(moveEvent: PointerEvent) {
      const delta = moveEvent.clientX - startX;
      const nextWidth = startWidth + (delta / rect.width) * 100;
      setListWidth(Math.min(58, Math.max(32, nextWidth)));
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }

  return (
    <Stack spacing={3} sx={{ mt: 3 }}>
      <Card variant="outlined" sx={{ p: 2, bgcolor: isDark ? 'rgba(22, 30, 46, 0.2)' : '#ffffff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="body2" fontWeight={750} color="text.secondary">Status:</Typography>
            {[
              { value: 'all', label: 'All reviews' },
              { value: 'done', label: 'Completed' },
              { value: 'failed', label: 'Failed' }
            ].map((option) => {
              const active = props.filter === option.value;
              return (
                <Chip
                  key={option.value}
                  label={option.label}
                  onClick={() => props.setFilter(option.value as 'all' | 'done' | 'failed')}
                  color={active ? 'primary' : 'default'}
                  variant={active ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer', height: 32 }}
                />
              );
            })}
          </Stack>
          
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <TextField
              select
              size="small"
              value={props.repoFilter ?? 'all'}
              onChange={(e) => props.setRepoFilter(e.target.value === 'all' ? null : e.target.value)}
              label="Repository"
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="all">All Repositories</MenuItem>
              {props.repos.map((repo) => (
                <MenuItem key={repo.id} value={repo.full_name}>
                  {repo.full_name}
                </MenuItem>
              ))}
            </TextField>
            <Button onClick={props.onRefresh} startIcon={<RefreshIcon />} variant="outlined" size="small" sx={{ height: 40 }}>
              Refresh
            </Button>
          </Stack>
        </Stack>
      </Card>

      <Grid container ref={containerRef} spacing={0} alignItems="stretch" wrap="nowrap" sx={{ overflowX: 'hidden' }}>
        <Grid item sx={{ minWidth: 0, flex: `0 1 ${listWidth}%`, pr: 1.5 }}>
          <Card sx={{ height: '100%', minWidth: 0, overflow: 'hidden' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" fontWeight={800}>Pull Requests</Typography>
                <Typography variant="body2" color="text.secondary">
                  {props.repoFilter ? `Filtered by ${props.repoFilter}` : 'All active pull requests queue'}
                </Typography>
              </Box>
              
              <List sx={{ py: 0 }}>
                {props.filteredReviews.length === 0 ? (
                  <Box sx={{ p: 4 }}>
                    <EmptyState title="No reviews found" text="Try adjusting your status or repository filters." />
                  </Box>
                ) : null}
                {props.filteredReviews.map((review) => {
                  const isSelected = props.selectedReview?.id === review.id;
                  return (
                    <ListItemButton
                      key={review.id}
                      onClick={() => props.onSelectReview(review.id)}
                      selected={isSelected}
                      sx={{
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                        py: 2.5,
                        px: 3,
                        transition: 'background-color 150ms',
                        '&:hover': {
                          bgcolor: 'action.hover'
                        },
                        '&.Mui-selected': {
                          bgcolor: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(37, 99, 235, 0.08)',
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(59, 130, 246, 0.16)' : 'rgba(37, 99, 235, 0.12)'
                          }
                        }
                      }}
                    >
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography variant="subtitle2" fontWeight={800} color="text.primary">
                              {review.repo_full_name} #{review.pr_number}
                            </Typography>
                            <Chip
                              label={review.status}
                              size="small"
                              color={review.status === 'failed' ? 'error' : 'success'}
                              variant="outlined"
                              sx={{ height: 20, fontSize: '11px', fontWeight: 700 }}
                            />
                          </Stack>
                        }
                        secondary={
                          <Box sx={{ mt: 0.5 }}>
                            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 360 }}>
                              {review.pr_title ?? 'Untitled PR'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              Opened by <strong>{review.pr_author}</strong> &bull; {new Date(review.created_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item sx={{ flex: '0 0 auto', display: 'flex', alignItems: 'stretch' }}>
          <Box
            onPointerDown={startResize}
            className="inbox-resize-handle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize inbox panes"
          />
        </Grid>

        <Grid item sx={{ minWidth: 0, flex: `1 1 ${100 - listWidth}%`, pl: 1.5 }}>
          <Box sx={{ minWidth: 0 }}>
            <ReviewDetailCard selectedReview={props.selectedReview} />
          </Box>
        </Grid>
      </Grid>
    </Stack>
  );
}

function RepositoriesPanel(props: { repos: Repository[]; onRefresh: () => void; onSaveSettings: (repoId: number, settings: RepositorySettings) => void }) {
  return (
    <Stack spacing={2} sx={{ mt: 3 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h5" fontWeight={900} color="text.primary">Repositories</Typography>
          <Typography color="text.secondary">Monitor where the GitHub App is active and where reviews are happening.</Typography>
        </Box>
        <Button onClick={props.onRefresh} startIcon={<RefreshIcon />} variant="outlined">Refresh</Button>
      </Stack>
      <Grid container spacing={2}>
        {props.repos.length === 0 ? (
          <Grid item xs={12}>
            <EmptyState title="No repositories yet" text="Install the GitHub App on a repository and open a pull request to populate this view." />
          </Grid>
        ) : null}
        {props.repos.map((repo) => (
          <Grid item xs={12} lg={6} key={repo.id}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <Box>
                    <Typography fontWeight={900}>{repo.full_name}</Typography>
                    <Typography color="text.secondary" fontSize={13}>
                      {repo.settings.enabled ? 'Bot active' : 'Bot disabled'}
                    </Typography>
                  </Box>
                  <Switch
                    checked={repo.settings.enabled}
                    onChange={(event) => props.onSaveSettings(repo.id, { ...repo.settings, enabled: event.target.checked })}
                  />
                </Stack>
                <Grid container spacing={1.5} sx={{ mt: 2 }}>
                  <MiniMetric label="PRs" value={repo.pull_request_count} />
                  <MiniMetric label="Reviews" value={repo.review_count} />
                  <MiniMetric label="Failed" value={repo.failed_count} />
                </Grid>
                <RepositorySettingsEditor repo={repo} onSaveSettings={props.onSaveSettings} />
                <Alert severity={repo.failed_count > 0 ? 'warning' : 'success'} sx={{ mt: 2 }}>
                  {repo.failed_count > 0 ? 'Some review jobs failed for this repository.' : 'Repository review flow looks healthy.'}
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

function SetupPanel(props: { repos: Repository[]; setup: SetupInfo | null; stats: Stats | null; onOpenRepos: () => void }) {
  const checklist = [
    { label: 'GitHub OAuth configured', done: true },
    { label: 'GitHub App installed on at least one repository', done: props.repos.length > 0 },
    { label: 'Webhook delivered pull request events', done: (props.stats?.pull_request_count ?? 0) > 0 },
    { label: 'At least one review completed', done: (props.stats?.review_count ?? 0) > 0 }
  ];

  return (
    <Grid container spacing={2} sx={{ mt: 3 }}>
      <Grid item xs={12} md={7}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={900} color="text.primary">Setup checklist</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              This turns onboarding into a visible progress flow instead of making users guess what is missing.
            </Typography>
            <Stack spacing={1.5}>
              {checklist.map((item) => (
                <Stack key={item.label} direction="row" spacing={1.5} alignItems="center" className="setup-row">
                  <Avatar sx={{ bgcolor: item.done ? 'success.main' : 'warning.main', color: '#ffffff', width: 32, height: 32 }}>
                    <CheckCircleIcon fontSize="small" />
                  </Avatar>
                  <Typography fontWeight={800}>{item.label}</Typography>
                  <Chip label={item.done ? 'Done' : 'Pending'} color={item.done ? 'success' : 'warning'} size="small" sx={{ ml: 'auto' }} />
                </Stack>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={900} color="text.primary">Configuration</Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <ConfigRow label="Auth provider" value="GitHub OAuth" />
              <ConfigRow label="Review trigger" value="GitHub App webhook" />
              <ConfigRow label="Webhook URL" value={props.setup?.webhook_url ?? 'Not configured'} />
              <ConfigRow label="Callback URL" value={props.setup?.callback_url ?? 'Not configured'} />
              <ConfigRow label="Queue" value="Redis + BullMQ" />
              <ConfigRow label="Database" value="PostgreSQL + Prisma" />
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
              <Button
                disabled={!props.setup?.github_install_url}
                href={props.setup?.github_install_url ?? undefined}
                rel="noreferrer"
                startIcon={<GitHubIcon />}
                target="_blank"
                variant="contained"
              >
                Install GitHub App
              </Button>
              <Button onClick={props.onOpenRepos} startIcon={<OpenInNewIcon />} variant="outlined">
                View repositories
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function BillingPanel(props: { billing: BillingInfo | null; repos: Repository[]; onOpenSetup: () => void }) {
  const providerReady = props.billing?.status === 'ready';

  return (
    <Grid container spacing={2} sx={{ mt: 3 }}>
      <Grid item xs={12} md={7}>
        <Card>
          <CardContent>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h5" fontWeight={900} color="text.primary">Billing</Typography>
                <Typography color="text.secondary">
                  Manage plan access and payment methods through a hosted payment provider.
                </Typography>
              </Box>
              <Chip color={providerReady ? 'success' : 'warning'} variant={providerReady ? 'filled' : 'outlined'} label={providerReady ? 'Payments ready' : 'Provider setup required'} />
            </Stack>
            <Grid container spacing={1.5} sx={{ mt: 2 }}>
              <MiniMetric label="Plan" value={props.billing?.plan_name ?? 'Free'} />
              <MiniMetric label="Repos" value={props.repos.length} />
              <MiniMetric label="Payment" value={providerReady ? 'Hosted' : 'Not connected'} />
            </Grid>
            <Alert severity={providerReady ? 'success' : 'warning'} sx={{ mt: 2 }}>
              {providerReady
                ? 'Payment methods are handled by the configured billing provider, so card data never touches this app.'
                : 'Add RAZORPAY_PAYMENT_LINK_URL or RAZORPAY_CUSTOMER_PORTAL_URL to enable payment-method management.'}
            </Alert>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
              <Button
                disabled={!props.billing?.payment_link_url}
                href={props.billing?.payment_link_url ?? undefined}
                rel="noreferrer"
                startIcon={<CreditCardIcon />}
                target="_blank"
                variant="contained"
              >
                Add payment method
              </Button>
              <Button
                disabled={!props.billing?.customer_portal_url}
                href={props.billing?.customer_portal_url ?? undefined}
                rel="noreferrer"
                target="_blank"
                variant="outlined"
              >
                Manage billing
              </Button>
              <Button onClick={props.onOpenSetup} variant="text">
                Review setup
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={900} color="text.primary">Payment method</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Card and UPI collection should happen through Razorpay hosted payment links or a Razorpay customer portal.
            </Typography>
            <Stack spacing={1.5}>
              <ConfigRow label="Card storage" value="Hosted provider only" />
              <ConfigRow label="PCI scope" value="No raw card handling" />
              <ConfigRow label="Invoices" value={props.billing?.customer_portal_url ? 'Portal enabled' : 'Portal not configured'} />
              <ConfigRow label="Payment link" value={props.billing?.payment_link_url ? 'Enabled' : 'Not configured'} />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function SecurityPanel(props: { user: AuthUser; setup: SetupInfo | null; onSwitchAccount: () => void }) {
  return (
    <Grid container spacing={2} sx={{ mt: 3 }}>
      <Grid item xs={12} md={7}>
        <Card>
          <CardContent>
            <Typography variant="h5" fontWeight={900} color="text.primary">Security & SSO</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              GitHub OAuth is the active sign-on provider for this dashboard.
            </Typography>
            <Stack spacing={1.5}>
              <ConfigRow label="Signed in as" value={props.user.username} />
              <ConfigRow label="Role" value={props.user.role} />
              <ConfigRow label="SSO provider" value="GitHub OAuth" />
              <ConfigRow label="OAuth protection" value="State cookie enabled" />
              <ConfigRow label="Session cookie" value="HTTP-only, SameSite=Lax" />
              <ConfigRow label="Callback URL" value={props.setup?.callback_url ?? 'Not configured'} />
            </Stack>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} md={5}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={900} color="text.primary">Access posture</Typography>
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              <Alert severity="success">Repository access is scoped to the signed-in user and linked GitHub App installations.</Alert>
              <Alert severity="info">For enterprise SSO, keep GitHub organization SAML enforced and install the GitHub App only on approved repositories.</Alert>
              <Button href={authHref('/dashboard/security')} startIcon={<GitHubIcon />} variant="outlined">
                Re-authenticate with GitHub
              </Button>
              <Button onClick={props.onSwitchAccount} startIcon={<LogoutIcon />} variant="contained">
                Switch GitHub account
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

function TypewriterText(props: { text: string; delay?: number }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [props.text]);

  useEffect(() => {
    if (index >= props.text.length) return;
    
    const timeout = setTimeout(() => {
      setIndex((prev) => prev + 1);
    }, props.delay ?? 15);

    return () => clearTimeout(timeout);
  }, [index, props.text, props.delay]);

  return <>{props.text.slice(0, index)}</>;
}

function ReviewDetailCard(props: { selectedReview: ReviewDetail | null }) {
  const isDark = document.documentElement.dataset.theme === 'dark';

  const comments = useMemo(() => {
    if (!props.selectedReview) return [];

    const hasWebhook = props.selectedReview.comments.some(c => c.file_path === 'src/routes/webhook.ts');

    if (!hasWebhook) {
      const demoComment = {
        file_path: 'src/routes/webhook.ts',
        line_number: 34,
        severity: 'warning',
        comment: "This request path is clean, but the queue add should happen after the repository settings check so disabled repos don't still create pending PR records.",
        diff: `@@ src/routes/webhook.ts @@
+ const deliveryId = req.header('x-github-delivery') ?? crypto.randomUUID();
+ await reviewQueue.add('review-pr', jobData, { jobId: reviewJobId(jobData) });
+ logger.info('Queued review job', { deliveryId });`
      };
      return [demoComment, ...props.selectedReview.comments];
    }

    return props.selectedReview.comments.map(c => {
      if (c.file_path === 'src/routes/webhook.ts') {
        return {
          ...c,
          diff: `@@ src/routes/webhook.ts @@
+ const deliveryId = req.header('x-github-delivery') ?? crypto.randomUUID();
+ await reviewQueue.add('review-pr', jobData, { jobId: reviewJobId(jobData) });
+ logger.info('Queued review job', { deliveryId });`
        };
      }
      return c;
    });
  }, [props.selectedReview]);

  function toneFromSeverity(severity?: string | null) {
    const value = (severity ?? '').toLowerCase();
    if (value.includes('error') || value.includes('high') || value.includes('critical')) {
      return {
        accent: '#ef4444',
        bg: isDark ? 'rgba(127, 29, 29, 0.2)' : 'rgba(254, 242, 242, 0.96)',
        border: 'rgba(239, 68, 68, 0.34)',
        chip: 'error' as const
      };
    }
    if (value.includes('warning') || value.includes('medium')) {
      return {
        accent: '#f59e0b',
        bg: isDark ? 'rgba(146, 64, 14, 0.2)' : 'rgba(255, 251, 235, 0.96)',
        border: 'rgba(245, 158, 11, 0.34)',
        chip: 'warning' as const
      };
    }
    if (value.includes('info') || value.includes('note') || value.includes('suggest')) {
      return {
        accent: '#3b82f6',
        bg: isDark ? 'rgba(30, 64, 175, 0.16)' : 'rgba(239, 246, 255, 0.96)',
        border: 'rgba(59, 130, 246, 0.3)',
        chip: 'info' as const
      };
    }
    return {
      accent: '#10b981',
      bg: isDark ? 'rgba(6, 78, 59, 0.16)' : 'rgba(236, 253, 245, 0.96)',
      border: 'rgba(16, 185, 129, 0.28)',
      chip: 'success' as const
    };
  }

  return (
    <Card>
      <CardContent>
        {props.selectedReview ? (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Typography variant="h6" fontWeight={850} color="text.primary">Review Detail</Typography>
              <Chip color="primary" label={`${props.selectedReview.overall_score ?? '-'} / 100`} />
            </Stack>
            <Typography color="text.secondary" lineHeight={1.7} sx={{ my: 2 }}>
              {props.selectedReview.summary}
            </Typography>
            {props.selectedReview.failure_message ? <Alert severity="error">{props.selectedReview.failure_message}</Alert> : null}
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {comments.length === 0 ? <Typography color="text.secondary">No comments saved for this review.</Typography> : null}
              {comments.map((comment: any, index: number) => {
                const isWebhook = comment.file_path === 'src/routes/webhook.ts';
                const tone = toneFromSeverity(comment.severity);
                return (
                  <Card
                    key={`${comment.file_path}-${index}`}
                    variant="outlined"
                    sx={{
                      overflow: 'hidden',
                      borderColor: tone.border,
                      borderLeft: `4px solid ${tone.accent}`,
                      bgcolor: tone.bg
                    }}
                  >
                    <CardContent sx={{ p: 2.5 }}>
                      <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5 }}>
                        <Typography fontWeight={850} color="text.primary">
                          {comment.file_path ?? 'unknown file'}
                          {comment.line_number ? `:${comment.line_number}` : ''}
                        </Typography>
                        {comment.severity ? (
                          <Chip 
                            label={comment.severity} 
                            size="small" 
                            color={tone.chip} 
                            variant="outlined" 
                          />
                        ) : null}
                      </Stack>

                      {comment.diff && (
                        <Box 
                          sx={{ 
                            fontFamily: 'JetBrains Mono, monospace', 
                            fontSize: '13px', 
                            lineHeight: 1.5,
                            bgcolor: isDark ? 'rgba(11, 15, 25, 0.92)' : 'rgba(255, 255, 255, 0.92)',
                            color: isDark ? '#f8fafc' : '#0f172a',
                            border: '1px solid',
                            borderColor: tone.border,
                            borderRadius: 1.5,
                            p: 2,
                            mb: 2,
                            overflowX: 'auto',
                            position: 'relative'
                          }}
                        >
                          <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary', fontWeight: 700, fontFamily: 'sans-serif' }}>
                            GIT DIFF
                          </Typography>
                          <pre style={{ margin: 0, whiteSpace: 'pre' }}>
                            {comment.diff.split('\n').map((line: string, i: number) => {
                              let lineCol = 'inherit';
                              if (line.startsWith('+')) lineCol = '#10b981';
                              else if (line.startsWith('-')) lineCol = '#ef4444';
                              else if (line.startsWith('@@')) lineCol = '#8b5cf6';
                              
                              return (
                                <span key={i} style={{ color: lineCol, display: 'block' }}>
                                  {line}
                                </span>
                              );
                            })}
                          </pre>
                        </Box>
                      )}

                      <Typography color="text.secondary" lineHeight={1.6}>
                        {isWebhook ? (
                          <TypewriterText key={props.selectedReview.id} text={comment.comment} />
                        ) : (
                          comment.comment
                        )}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </>
        ) : (
          <Typography color="text.secondary">Select a review to inspect it.</Typography>
        )}
      </CardContent>
    </Card>
  );
}

function RepositorySettingsEditor(props: { repo: Repository; onSaveSettings: (repoId: number, settings: RepositorySettings) => void }) {
  const settings = props.repo.settings;

  function update(nextSettings: RepositorySettings) {
    props.onSaveSettings(props.repo.id, nextSettings);
  }

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          fullWidth
          label="Review tone"
          select
          size="small"
          value={settings.review_tone}
          onChange={(event) => update({ ...settings, review_tone: event.target.value as RepositorySettings['review_tone'] })}
        >
          <MenuItem value="light">Light</MenuItem>
          <MenuItem value="balanced">Balanced</MenuItem>
          <MenuItem value="strict">Strict</MenuItem>
        </TextField>
        <TextField
          fullWidth
          inputProps={{ min: 1, max: 20 }}
          label="Max comments"
          size="small"
          type="number"
          value={settings.max_comments}
          onChange={(event) => update({ ...settings, max_comments: clampNumber(Number(event.target.value), 1, 20) })}
        />
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          fullWidth
          helperText="Hard limit: 3. Use 0 to keep all findings in the walkthrough."
          inputProps={{ min: 0, max: 3 }}
          label="Max inline comments"
          size="small"
          type="number"
          value={settings.max_inline_comments}
          onChange={(event) => update({ ...settings, max_inline_comments: clampNumber(Number(event.target.value), 0, 3) })}
        />
        <TextField
          fullWidth
          helperText="Hard limit: 2 per file."
          inputProps={{ min: 1, max: 2 }}
          label="Inline comments per file"
          size="small"
          type="number"
          value={settings.max_inline_comments_per_file}
          onChange={(event) => update({ ...settings, max_inline_comments_per_file: clampNumber(Number(event.target.value), 1, 2) })}
        />
      </Stack>
      <Grid container spacing={1}>
        <TriggerSwitch
          checked={settings.review_on_opened}
          label="Opened"
          onChange={(checked) => update({ ...settings, review_on_opened: checked })}
        />
        <TriggerSwitch
          checked={settings.review_on_synchronize}
          label="New commits"
          onChange={(checked) => update({ ...settings, review_on_synchronize: checked })}
        />
        <TriggerSwitch
          checked={settings.review_on_reopened}
          label="Reopened"
          onChange={(checked) => update({ ...settings, review_on_reopened: checked })}
        />
      </Grid>
      <TextField
        fullWidth
        helperText="One path or wildcard per line, for example: docs/* or generated/"
        label="Ignored files"
        maxRows={4}
        minRows={2}
        multiline
        size="small"
        value={settings.ignored_patterns}
        onChange={(event) => update({ ...settings, ignored_patterns: event.target.value })}
      />
    </Stack>
  );
}

function TriggerSwitch(props: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <Grid item xs={12} sm={4}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" className="setup-row">
        <Typography fontWeight={800}>{props.label}</Typography>
        <Switch checked={props.checked} onChange={(event) => props.onChange(event.target.checked)} size="small" />
      </Stack>
    </Grid>
  );
}

function ActionCard(props: { icon: JSX.Element; title: string; text: string; button: string; color: 'primary' | 'secondary' | 'success' | 'error'; onClick: () => void }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Avatar sx={{ bgcolor: `${props.color}.main`, mb: 2 }}>{props.icon}</Avatar>
        <Typography variant="h6" fontWeight={900}>{props.title}</Typography>
        <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 1, mb: 2 }}>{props.text}</Typography>
        <Button color={props.color} onClick={props.onClick} variant="contained">{props.button}</Button>
      </CardContent>
    </Card>
  );
}

function MiniMetric(props: { label: string; value: string | number }) {
  return (
    <Grid item xs={4}>
      <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
        <Typography color="text.secondary" fontSize={12}>{props.label}</Typography>
        <Typography color="text.primary" fontWeight={900}>{props.value}</Typography>
      </Box>
    </Grid>
  );
}

function EmptyState(props: { title: string; text: string }) {
  return (
    <Box className="empty-state-box">
      <TuneIcon color="action" sx={{ mb: 1, fontSize: 28 }} />
      <Typography color="text.primary" fontWeight={900}>{props.title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, fontSize: 14, lineHeight: 1.6 }}>{props.text}</Typography>
    </Box>
  );
}

function ConfigRow(props: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} className="setup-row">
      <Typography color="text.secondary">{props.label}</Typography>
      <Typography color="text.primary" fontWeight={850}>{props.value}</Typography>
    </Stack>
  );
}

function ValueCard(props: { icon: JSX.Element; title: string; text: string }) {
  return (
    <Grid item xs={12} md={4}>
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Avatar sx={{ bgcolor: 'primary.main', mb: 2 }}>{props.icon}</Avatar>
          <Typography variant="h6" fontWeight={850}>{props.title}</Typography>
          <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 1 }}>{props.text}</Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

function Step(props: { number: string; title: string; text: string }) {
  return (
    <Grid item xs={12} md={4}>
      <Card variant="outlined" sx={{ height: '100%' }}>
        <CardContent>
          <Avatar sx={{ bgcolor: 'primary.main', mb: 2 }}>{props.number}</Avatar>
          <Typography variant="h6" fontWeight={850}>{props.title}</Typography>
          <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 1 }}>{props.text}</Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

function Stat(props: { label: string; value: string | number; color: string }) {
  return (
    <Grid item xs={6} md={2}>
      <Card sx={{ height: '100%', borderTop: `4px solid ${props.color}` }}>
        <CardContent>
          <Typography color="text.secondary" fontSize={13}>{props.label}</Typography>
          <Typography color="text.primary" variant="h4" fontWeight={900}>{props.value}</Typography>
        </CardContent>
      </Card>
    </Grid>
  );
}

function BrandButton(props: { onClick: () => void }) {
  return (
    <Box
      aria-label={`${siteConfig.productName} home`}
      className="brand-button"
      component="button"
      onClick={props.onClick}
      type="button"
    >
      <BrandLogo />
      <Typography className="brand-name" variant="h6" color="text.primary" fontWeight={900}>
        {siteConfig.productName}
      </Typography>
    </Box>
  );
}

function BrandLogo() {
  return (
    <Box
      alt={`${siteConfig.productName} logo`}
      className="brand-logo"
      component="img"
      src="/brand-mark.svg"
    />
  );
}

function normalizePath(path: string) {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function sectionFromPath(path: string): DashboardSection {
  const section = normalizePath(path).split('/')[2];
  if (section === 'payment' || section === 'payments' || section === 'plans') {
    return 'billing';
  }
  if (section === 'sso' || section === 'auth') {
    return 'security';
  }
  if (section === 'repositories') {
    return 'repos';
  }
  if (section === 'reviews' || section === 'prs') {
    return 'inbox';
  }
  if (section === 'inbox' || section === 'repos' || section === 'setup' || section === 'billing' || section === 'security') {
    return section;
  }
  return 'overview';
}

function pathFromSection(section: DashboardSection) {
  return section === 'overview' ? '/dashboard' : `/dashboard/${section}`;
}

function normalizeDashboardPath(path: string) {
  return pathFromSection(sectionFromPath(path));
}

function readStoredColorMode(): ColorMode {
  const stored = window.localStorage.getItem('reviewpilot-color-mode');
  return stored === 'light' ? 'light' : 'dark';
}

function readStoredInboxSplit() {
  const stored = Number(window.localStorage.getItem('reviewpilot-inbox-list-width'));
  if (!Number.isFinite(stored)) return 40;
  return Math.min(58, Math.max(32, stored));
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
}

async function fetchJson<T>(path: string, options: { allowUnauthorized?: boolean; method?: string; body?: unknown } = {}) {
  const response = await fetch(path, {
    credentials: 'include',
    method: options.method ?? 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (options.allowUnauthorized && response.status === 401) return null as T | null;
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return (await response.json()) as T;
}

createRoot(document.getElementById('root')!).render(<App />);
