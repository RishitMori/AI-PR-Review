import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
  const radius = variant === 'landing' ? 16 : 20;

  return createTheme({
    palette: {
      mode,
      primary: isDark ? { main: '#62f3ff' } : { main: '#2563eb' },
      secondary: isDark ? { main: '#8b5cf6' } : { main: '#0f9f7a' },
      warning: { main: '#b45309' },
      error: { main: '#c2415d' },
      background: isDark
        ? { default: '#090b12', paper: '#101521' }
        : { default: '#f6f8fc', paper: '#ffffff' },
      text: isDark ? { primary: '#ecf3ff', secondary: '#9aa6bf' } : { primary: '#172026', secondary: '#5f6b7a' }
    },
    shape: { borderRadius: radius },
    typography: {
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: { fontWeight: 900, letterSpacing: variant === 'landing' ? -1.5 : 0 },
      h2: { fontWeight: 900, letterSpacing: variant === 'landing' ? -1 : 0 },
      h3: { fontWeight: 850, letterSpacing: variant === 'landing' ? -0.7 : 0 },
      button: { textTransform: 'none', fontWeight: 700 }
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: isDark ? '#090b12' : '#f6f8fc',
            color: isDark ? '#ecf3ff' : '#172026',
            backgroundImage: isDark
              ? 'radial-gradient(circle at 20% 20%, rgba(98, 243, 255, 0.08), transparent 30%), radial-gradient(circle at 85% 10%, rgba(139, 92, 246, 0.12), transparent 24%), linear-gradient(180deg, #090b12 0%, #0a0d16 45%, #090b12 100%)'
              : 'linear-gradient(180deg, #f8fbff 0%, #f6f8fc 54%, #ffffff 100%)',
            transition: 'background-color 220ms ease, color 220ms ease'
          },
          '*::selection': {
            backgroundColor: isDark ? 'rgba(98, 243, 255, 0.24)' : 'rgba(37, 99, 235, 0.2)'
          }
        }
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: isDark ? 'rgba(9, 11, 18, 0.68)' : 'rgba(255, 255, 255, 0.72)',
            borderBottom: isDark ? '1px solid rgba(148, 163, 184, 0.14)' : '1px solid #dde6ef',
            backdropFilter: 'blur(22px)'
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: isDark ? 'linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))' : 'none',
            backgroundColor: isDark ? undefined : '#ffffff',
            border: isDark ? '1px solid rgba(148, 163, 184, 0.16)' : '1px solid #dde6ef',
            boxShadow: isDark ? '0 24px 80px rgba(0, 0, 0, 0.38)' : '0 18px 45px rgba(31, 45, 61, 0.08)'
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            transition: 'transform 180ms ease, box-shadow 180ms ease, background-color 180ms ease'
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            border: isDark ? '1px solid rgba(98, 243, 255, 0.18)' : '1px solid #d6e0ef',
            backgroundColor: isDark ? 'rgba(12, 17, 30, 0.9)' : '#f3f7fd',
            color: 'inherit'
          },
          label: {
            color: 'inherit'
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
  { value: '10k+', label: 'lines summarized' },
  { value: '3-step', label: 'setup flow' },
  { value: '<60s', label: 'time to first review' },
  { value: '1 comment', label: 'per PR thread' }
];

const landingPricing = [
  {
    name: 'Starter',
    price: '$0',
    text: 'For one repo and fast proof-of-value.',
    features: ['GitHub App install', 'Webhook reviews', 'Basic dashboard']
  },
  {
    name: 'Pro',
    price: '$29',
    text: 'For teams shipping code every day.',
    features: ['Multi-repo review policies', 'Worker queue visibility', 'Priority support'],
    featured: true
  },
  {
    name: 'Scale',
    price: 'Custom',
    text: 'For larger orgs and tighter workflows.',
    features: ['Advanced routing', 'Custom limits', 'SLA and onboarding']
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
  const codeSample = `git diff --unified=4
@@ src/routes/webhook.ts @@
+ const deliveryId = req.header('x-github-delivery') ?? crypto.randomUUID();
+ await reviewQueue.add('review-pr', jobData, { jobId: reviewJobId(jobData) });
+ logger.info('Queued review job', { deliveryId });

ReviewPilot comment:
"This request path is clean, but the queue add should happen after the repository settings check so disabled repos don't still create pending PR records."`;

  useEffect(() => {
    let index = 0;
    setTypedCode('');
    const timer = window.setInterval(() => {
      index += 1;
      setTypedCode(codeSample.slice(0, index));
      if (index >= codeSample.length) {
        window.clearInterval(timer);
      }
    }, 14);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <Box className="landing-shell">
      <Box className="landing-orb landing-orb-a" />
      <Box className="landing-orb landing-orb-b" />
      <Box className="landing-orb landing-orb-c" />

      <AppBar position="sticky" elevation={0} sx={{ bgcolor: isDark ? 'rgba(9, 11, 18, 0.72)' : 'rgba(255, 255, 255, 0.72)' }}>
        <Toolbar sx={{ width: '100%', maxWidth: 1440, mx: 'auto', minHeight: 78, gap: 2 }}>
          <BrandButton onClick={() => props.onNavigate('/')} />
          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' }, ml: 2 }}>
            <Button sx={{ color: 'text.primary' }} onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>Product</Button>
            <Button sx={{ color: 'text.primary' }} onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}>Workflow</Button>
            <Button sx={{ color: 'text.primary' }} onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}>Pricing</Button>
            <Button sx={{ color: 'text.primary' }} onClick={props.onDashboard}>Dashboard</Button>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Button
            sx={{ color: 'text.primary', display: 'inline-flex' }}
            onClick={props.onToggleColorMode}
            startIcon={props.colorMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
          >
            {props.colorMode === 'dark' ? 'Light mode' : 'Dark mode'}
          </Button>
          <Button
            onClick={() => document.getElementById('workflow')?.scrollIntoView({ behavior: 'smooth' })}
            startIcon={<GitHubIcon />}
            sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: 'text.primary' }}
          >
            GitHub App
          </Button>
          <Button href={authHref('/dashboard/setup')} variant="contained" size="large">
            Get Started
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ position: 'relative', py: { xs: 7, md: 10 } }}>
        <Stack spacing={4} sx={{ width: '100%' }}>
          <RevealSection>
            <Stack spacing={3} alignItems="center" textAlign="center" sx={{ maxWidth: 1120, mx: 'auto' }}>
              <Chip icon={<AutoFixHighIcon />} label="AI review for GitHub pull requests" sx={{ width: 'fit-content' }} />
              <Typography variant="h1" sx={{ fontSize: { xs: 40, sm: 54, md: 70 }, lineHeight: 1.02, maxWidth: 960 }}>
                A sharper second pair of eyes for every pull request.
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: { xs: 17, md: 19 }, lineHeight: 1.75, maxWidth: 820 }}>
                ReviewPilot listens to GitHub webhooks, checks the diff, and posts concise review comments before a PR stalls in the queue. Built for teams that want fast feedback without noisy AI slop.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button href={authHref('/dashboard/setup')} size="large" variant="contained">
                  Connect GitHub
                </Button>
                <Button size="large" variant="outlined" onClick={() => document.getElementById('hero-demo')?.scrollIntoView({ behavior: 'smooth' })}>
                  Watch demo
                </Button>
              </Stack>
              <Box className="hero-flow">
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
              <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="center" useFlexGap>
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
            <Grid container spacing={2.5}>
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
          <Stack spacing={3}>
            <SectionHeading eyebrow="Social proof" title="Teams like fast feedback and fewer review bottlenecks." text="Use these sections to show confidence without cluttering the page." />
            <Grid container spacing={2}>
              {landingStats.map((stat) => (
                <Grid item xs={6} md={3} key={stat.label}>
                  <Card className="stat-card hover-card">
                    <CardContent>
                      <Typography variant="h4" sx={{ fontWeight: 900 }}>
                        {stat.value}
                      </Typography>
                      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                        {stat.label}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </RevealSection>
      </Container>

      <Container id="pricing" maxWidth="xl" sx={{ py: { xs: 6, md: 8 } }}>
        <RevealSection>
          <Stack spacing={3}>
            <SectionHeading eyebrow="Pricing" title="Simple tiers for teams of any size." text="A clean card layout keeps the page looking like a real SaaS launch, not a generic template." />
            <Grid container spacing={2.5}>
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
          <Card className="final-cta-card">
            <CardContent sx={{ p: { xs: 3, md: 6 }, textAlign: 'center' }}>
              <Typography variant="h2" sx={{ fontSize: { xs: 34, md: 54 }, lineHeight: 1.05 }}>
                Make every pull request feel reviewed already.
              </Typography>
              <Typography color="text.secondary" sx={{ maxWidth: 720, mx: 'auto', mt: 2, lineHeight: 1.8 }}>
                Connect GitHub, start the worker, and let ReviewPilot do the first pass so your team can focus on the parts that matter.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 3 }}>
                <Button href={authHref('/dashboard/setup')} size="large" variant="contained">
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

      <Footer onNavigate={props.onNavigate} />
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
    <LegalShell title="Page not found" icon={<ManageSearchIcon />} onNavigate={props.onNavigate}>
      <Card>
        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          <Typography variant="h4" fontWeight={850}>
            This route is not available.
          </Typography>
          <Typography color="text.secondary" lineHeight={1.7} sx={{ mt: 2 }}>
            The link may be outdated, or the page may belong inside the dashboard.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 3 }}>
            <Button onClick={() => props.onNavigate('/')} variant="contained">
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

function LegalShell(props: { title: string; icon: JSX.Element; children: React.ReactNode; onNavigate: (path: string) => void; colorMode: ColorMode; onToggleColorMode: () => void }) {
  return (
    <Box className="landing-shell" sx={{ minHeight: '100vh' }}>
      <AppBar color="transparent" elevation={0} position="sticky" sx={{ backdropFilter: 'blur(14px)', borderBottom: '1px solid', borderColor: 'divider', color: 'text.primary' }}>
        <Toolbar sx={{ maxWidth: 1280, width: '100%', mx: 'auto', gap: 2 }}>
          <BrandButton onClick={() => props.onNavigate('/')} />
          <Button sx={{ color: 'text.primary' }} onClick={() => props.onNavigate('/terms')}>
            Terms
          </Button>
          <Button sx={{ color: 'text.primary' }} onClick={() => props.onNavigate('/privacy')}>
            Privacy
          </Button>
          <Button sx={{ color: 'text.primary' }} onClick={() => props.onNavigate('/')}> 
            Home
          </Button>
          <Button sx={{ color: 'text.primary' }} onClick={props.onToggleColorMode} startIcon={props.colorMode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}>
            {props.colorMode === 'dark' ? 'Light mode' : 'Dark mode'}
          </Button>
          <Button href={authHref()} startIcon={<GitHubIcon />} variant="contained" sx={{ color: 'text.primary' }}>
            Start free
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
        <Avatar sx={{ bgcolor: 'primary.main', mb: 2 }}>{props.icon}</Avatar>
        <Typography variant="h2" color="text.primary" sx={{ mb: 1 }}>
          {props.title}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 4 }}>
          Last updated: August 13, 2026
        </Typography>
        <Stack spacing={2}>{props.children}</Stack>
      </Container>
      <Footer onNavigate={props.onNavigate} />
    </Box>
  );
}

function LegalSection(props: { title: string; text: string }) {
  return (
    <Card>
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

function Footer(props: { onNavigate: (path: string) => void }) {
  return (
    <Box component="footer" sx={{ borderTop: '1px solid rgba(148, 163, 184, 0.14)', py: 5 }}>
      <Container maxWidth="xl">
        <Grid container spacing={3} alignItems="end">
          <Grid item xs={12} md={5}>
            <BrandButton onClick={() => props.onNavigate('/')} />
            <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 420, lineHeight: 1.7 }}>
              AI pull request reviews with a dark, developer-first interface.
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button onClick={() => props.onNavigate('/terms')}>Terms</Button>
              <Button onClick={() => props.onNavigate('/privacy')}>Privacy</Button>
              <Button onClick={() => props.onNavigate('/contact')}>Contact</Button>
              <Button href={siteConfig.linkedinUrl} rel="noreferrer" startIcon={<LinkedInIcon />} target="_blank">
                LinkedIn
              </Button>
            </Stack>
          </Grid>
          <Grid item xs={12} md={3}>
            <Stack spacing={1.25}>
              <Typography fontWeight={800}>Newsletter</Typography>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth placeholder="Email address" size="small" />
                <Button href={`mailto:${siteConfig.supportEmail}?subject=ReviewPilot%20early%20access`} variant="contained">Request access</Button>
              </Stack>
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function RevealSection(props: { children: ReactNode; delay?: number }) {
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
      { threshold: 0.16 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      className={`reveal-section ${visible ? 'is-visible' : ''}`}
      sx={{ transitionDelay: `${props.delay ?? 0}ms` }}
    >
      {props.children}
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
      <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center' }}>
        <Typography>Preparing your dashboard...</Typography>
      </Box>
    );
  }

  if (!user) {
    return (
      <Box minHeight="100vh" display="grid" sx={{ placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
        <Card sx={{ maxWidth: 620 }}>
          <CardContent sx={{ p: 4 }}>
            <Chip color="secondary" label="ReviewPilot dashboard" sx={{ mb: 2, fontWeight: 800 }} />
            <Typography variant="h3">Sign in to see your pull request reviews.</Typography>
            <Typography color="text.secondary" sx={{ my: 2 }}>
              Your dashboard shows repositories, recent reviews, saved comments, and failed review runs.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <Button href={authHref(normalizeDashboardPath(props.path))} startIcon={<GitHubIcon />} variant="contained">
                Login with GitHub
              </Button>
              <Button onClick={props.onHome} variant="outlined">
                View homepage
              </Button>
            </Stack>
            <Typography color="text.secondary" fontSize={13} sx={{ mt: 2 }}>
              Login uses GitHub OAuth. ReviewPilot only shows repositories installed through the GitHub App.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', py: { xs: 2, md: 3 } }}>
      <Container className="dashboard-shell" disableGutters maxWidth={false} sx={{ width: '100%', px: { xs: 2, sm: 3, lg: 4 }, mx: 0 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'flex-start' }} spacing={2} sx={{ width: '100%' }}>
          <Box>
            <BrandButton onClick={props.onHome} />
            <Typography
              variant="h2"
              color="text.primary"
              sx={{
                fontSize: { xs: 34, sm: 44, lg: 56 },
                lineHeight: 1.04,
                mt: 1,
                maxWidth: 920
              }}
            >
              Pull request review dashboard
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Review activity, repository health, and setup status in one place.
            </Typography>
          </Box>
          <Stack
            className="dashboard-user-actions"
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent={{ xs: 'flex-start', lg: 'flex-end' }}
            flexWrap="wrap"
            useFlexGap
          >
            <Avatar src={user.avatarUrl ?? undefined} sx={{ height: 40, width: 40 }}>{user.username[0]?.toUpperCase()}</Avatar>
            <Typography color="text.primary" fontWeight={800} sx={{ mr: { xs: 0, sm: 1 } }}>{user.username}</Typography>
            <IconButton onClick={props.onToggleColorMode} color="inherit" aria-label="toggle color mode" sx={{ border: '1px solid', borderColor: 'divider' }}>
              {props.colorMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
            <Button onClick={props.onHome} size="small" variant="outlined" sx={{ color: 'text.primary' }}>
              Home
            </Button>
            <Button onClick={logout} size="small" startIcon={<LogoutIcon />} variant="outlined" sx={{ color: 'text.primary' }}>
              Logout
            </Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert> : null}

        <Card sx={{ mt: 3, width: '100%' }}>
          <CardContent sx={{ pb: 1 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h6" fontWeight={900} color="text.primary">
                  Daily review command center
                </Typography>
                <Typography color="text.secondary">
                  Start here to see what needs attention, what shipped cleanly, and whether setup is healthy.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                <Chip color={failedReviews.length > 0 ? 'error' : 'success'} label={`${failedReviews.length} failed runs`} />
                <Chip color="primary" label={`${completedReviews.length} completed reviews`} />
                <Chip color="secondary" label={`${repos.length} connected repos`} />
              </Stack>
            </Stack>
            <Tabs
              value={section}
              onChange={(_event, value) => openSection(value)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ mt: 2 }}
            >
              <Tab icon={<InsightsIcon />} iconPosition="start" label="Overview" value="overview" />
              <Tab icon={<ManageSearchIcon />} iconPosition="start" label="PR Inbox" value="inbox" />
              <Tab icon={<GitHubIcon />} iconPosition="start" label="Repositories" value="repos" />
              <Tab icon={<SettingsIcon />} iconPosition="start" label="Setup" value="setup" />
              <Tab icon={<CreditCardIcon />} iconPosition="start" label="Billing" value="billing" />
              <Tab icon={<VerifiedUserIcon />} iconPosition="start" label="Security & SSO" value="security" />
            </Tabs>
          </CardContent>
        </Card>

        {section === 'overview' ? (
          <OverviewPanel
            stats={stats}
            latestReview={latestReview}
            failedReviews={failedReviews}
            completedReviews={completedReviews}
            repos={repos}
            setup={setup}
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
  );
}

function OverviewPanel(props: {
  stats: Stats | null;
  latestReview: ReviewListItem | null;
  failedReviews: ReviewListItem[];
  completedReviews: ReviewListItem[];
  repos: Repository[];
  setup: SetupInfo | null;
  onRefresh: () => void;
  onOpenInbox: () => void;
  onOpenSetup: () => void;
}) {
  const successRate = props.stats?.pull_request_count
    ? Math.round(((props.stats.pull_request_count - (props.stats.failed_count ?? 0)) / props.stats.pull_request_count) * 100)
    : 100;

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
  return (
    <Grid container spacing={2} sx={{ mt: 3 }}>
      <Grid item xs={12} md={3}>
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6" fontWeight={850} color="text.primary">Sections</Typography>
              <Button onClick={props.onRefresh} size="small" startIcon={<RefreshIcon />}>Refresh</Button>
            </Stack>
            <List dense sx={{ mt: 1 }}>
              <ListItemButton selected={props.filter === 'all'} onClick={() => props.setFilter('all')} sx={{ borderRadius: 1 }}>
                <ListItemText primary="All reviewed PRs" secondary="Everything the bot has processed" />
              </ListItemButton>
              <ListItemButton selected={props.filter === 'done'} onClick={() => props.setFilter('done')} sx={{ borderRadius: 1 }}>
                <ListItemText primary="Completed" secondary="Reviews posted successfully" />
              </ListItemButton>
              <ListItemButton selected={props.filter === 'failed'} onClick={() => props.setFilter('failed')} sx={{ borderRadius: 1 }}>
                <ListItemText primary="Needs attention" secondary="Failed jobs and broken flows" />
              </ListItemButton>
            </List>
            <Typography variant="overline" color="text.secondary">Repositories</Typography>
            <List dense>
              <ListItemButton selected={!props.repoFilter} onClick={() => props.setRepoFilter(null)} sx={{ borderRadius: 1 }}>
                <ListItemText primary="All repositories" secondary={`${props.repos.length} connected`} />
              </ListItemButton>
              {props.repos.slice(0, 6).map((repo) => (
                <ListItemButton key={repo.id} selected={props.repoFilter === repo.full_name} onClick={() => props.setRepoFilter(repo.full_name)} sx={{ borderRadius: 1 }}>
                  <ListItemText primary={repo.full_name} secondary={`${repo.review_count} reviews`} />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" fontWeight={850}>PR Inbox</Typography>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              {props.repoFilter ? `Filtered to ${props.repoFilter}.` : 'A daily work queue for reviewed pull requests.'}
            </Typography>
            <List sx={{ mt: 1 }}>
              {props.filteredReviews.length === 0 ? <EmptyState title="No PRs here" text="Try another inbox section or create a test pull request." /> : null}
              {props.filteredReviews.map((review) => (
                <ListItemButton
                  key={review.id}
                  onClick={() => props.onSelectReview(review.id)}
                  selected={props.selectedReview?.id === review.id}
                  sx={{ borderRadius: 1, mb: 1, border: '1px solid #e3e9ef' }}
                >
                  <ListItemText
                    primary={`${review.repo_full_name} #${review.pr_number}`}
                    secondary={review.pr_title}
                  />
                  <Chip color={review.status === 'failed' ? 'error' : 'success'} label={review.status} size="small" />
                </ListItemButton>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={5}>
        <ReviewDetailCard selectedReview={props.selectedReview} />
      </Grid>
    </Grid>
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
                  <Avatar sx={{ bgcolor: item.done ? 'success.main' : 'grey.300', width: 32, height: 32 }}>
                    <CheckCircleIcon fontSize="small" />
                  </Avatar>
                  <Typography fontWeight={800}>{item.label}</Typography>
                  <Chip label={item.done ? 'Done' : 'Pending'} color={item.done ? 'success' : 'default'} size="small" sx={{ ml: 'auto' }} />
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
              <Chip color={providerReady ? 'success' : 'warning'} label={providerReady ? 'Payments ready' : 'Provider setup required'} />
            </Stack>
            <Grid container spacing={1.5} sx={{ mt: 2 }}>
              <MiniMetric label="Plan" value={props.billing?.plan_name ?? 'Free'} />
              <MiniMetric label="Repos" value={props.repos.length} />
              <MiniMetric label="Payment" value={providerReady ? 'Hosted' : 'Not connected'} />
            </Grid>
            <Alert severity={providerReady ? 'success' : 'info'} sx={{ mt: 2 }}>
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

function ReviewDetailCard(props: { selectedReview: ReviewDetail | null }) {
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
              {props.selectedReview.comments.length === 0 ? <Typography color="text.secondary">No comments saved for this review.</Typography> : null}
              {props.selectedReview.comments.map((comment, index) => (
                <Card key={`${comment.file_path}-${index}`} variant="outlined">
                  <CardContent>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={850}>
                        {comment.file_path ?? 'unknown file'}
                        {comment.line_number ? `:${comment.line_number}` : ''}
                      </Typography>
                      {comment.severity ? <Chip label={comment.severity} size="small" variant="outlined" /> : null}
                    </Stack>
                    <Typography color="text.secondary" lineHeight={1.6} sx={{ mt: 1 }}>
                      {comment.comment}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
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
    <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 1, p: 3, textAlign: 'center' }}>
      <TuneIcon color="action" />
      <Typography color="text.primary" fontWeight={900}>{props.title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>{props.text}</Typography>
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
