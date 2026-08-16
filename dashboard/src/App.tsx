import { useEffect, useMemo, useState } from 'react';
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
import EmailIcon from '@mui/icons-material/Email';
import GitHubIcon from '@mui/icons-material/GitHub';
import InsightsIcon from '@mui/icons-material/Insights';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import LogoutIcon from '@mui/icons-material/Logout';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PolicyIcon from '@mui/icons-material/Policy';
import RefreshIcon from '@mui/icons-material/Refresh';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import SecurityIcon from '@mui/icons-material/Security';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
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

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#2563eb' },
    secondary: { main: '#0f9f7a' },
    warning: { main: '#b45309' },
    error: { main: '#c2415d' },
    background: { default: '#f6f8fc', paper: '#ffffff' },
    text: { primary: '#172026', secondary: '#5f6b7a' }
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h1: { fontWeight: 850, letterSpacing: 0 },
    h2: { fontWeight: 800, letterSpacing: 0 },
    h3: { fontWeight: 800, letterSpacing: 0 },
    button: { textTransform: 'none', fontWeight: 700 }
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          border: '1px solid #dde6ef',
          boxShadow: '0 18px 45px rgba(31, 45, 61, 0.08)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 6
        }
      }
    }
  }
});

const siteConfig = {
  productName: 'ReviewPilot',
  companyName: 'Your Company Name',
  supportEmail: 'rishit164@gmail.com',
  instagramUrl: 'https://www.instagram.com/rishitmori?igsh=NW1lMHN1d2JlaGc5&utm_source=qr',
  linkedinUrl: 'https://www.linkedin.com/in/rishit-mori-aa9ab7201/'
};

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
  const isDashboard = path.startsWith('/dashboard');
  const isTerms = path === '/terms';
  const isPrivacy = path === '/privacy';
  const isContact = path === '/contact';

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  function navigate(nextPath: string) {
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isDashboard ? <DashboardApp onHome={() => navigate('/')} /> : null}
      {isTerms ? <TermsPage onNavigate={navigate} /> : null}
      {isPrivacy ? <PrivacyPage onNavigate={navigate} /> : null}
      {isContact ? <ContactPage onNavigate={navigate} /> : null}
      {!isDashboard && !isTerms && !isPrivacy && !isContact ? <PublicHome onDashboard={() => navigate('/dashboard')} onNavigate={navigate} /> : null}
    </ThemeProvider>
  );
}

function PublicHome(props: { onDashboard: () => void; onNavigate: (path: string) => void }) {
  const [activeFinding, setActiveFinding] = useState(0);

  return (
    <Box className="landing-bg">
      <AppBar color="transparent" elevation={0} position="sticky" sx={{ backdropFilter: 'blur(14px)', borderBottom: '1px solid #dde6ef' }}>
        <Toolbar sx={{ maxWidth: 1280, width: '100%', mx: 'auto', gap: 2 }}>
          <BrandButton onClick={() => props.onNavigate('/')} />
          <Button color="inherit" onClick={() => document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth' })}>
            Preview
          </Button>
          <Button color="inherit" onClick={props.onDashboard}>
            Dashboard
          </Button>
          <Button color="inherit" onClick={() => props.onNavigate('/contact')}>
            Contact
          </Button>
          <Button href="/auth/github" startIcon={<GitHubIcon />} variant="contained">
            Start free
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 7, md: 12 } }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={7}>
            <Chip color="secondary" label="AI pull request reviews for busy teams" sx={{ mb: 2, fontWeight: 800 }} />
            <Typography variant="h1" sx={{ fontSize: { xs: 44, md: 76 }, lineHeight: 0.98, mb: 3 }}>
              Catch risky code before it reaches production.
            </Typography>
            <Typography color="text.secondary" fontSize={18} lineHeight={1.7} maxWidth={680}>
              Connect GitHub, open a pull request, and get a clear review comment focused on the code that changed.
              Useful feedback, fewer review delays, and a dashboard your team can understand at a glance.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }}>
              <Button href="/auth/github" size="large" startIcon={<GitHubIcon />} variant="contained">
                Connect GitHub
              </Button>
              <Button size="large" variant="outlined" onClick={() => document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth' })}>
                See example review
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
              <Typography color="text.secondary" fontSize={13}>
                By continuing, you agree to the
              </Typography>
              <Button size="small" onClick={() => props.onNavigate('/terms')} sx={{ minWidth: 0, p: 0 }}>
                Terms
              </Button>
              <Typography color="text.secondary" fontSize={13}>
                and
              </Typography>
              <Button size="small" onClick={() => props.onNavigate('/privacy')} sx={{ minWidth: 0, p: 0 }}>
                Privacy Policy
              </Button>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 3 }}>
              {['GitHub App based', 'Posts to PRs', 'Review history', 'Free-model friendly'].map((label) => (
                <Chip key={label} label={label} variant="outlined" />
              ))}
            </Stack>
          </Grid>

          <Grid item xs={12} md={5}>
            <Card className="preview-card">
              <CardContent sx={{ p: 0 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 2, bgcolor: '#f5f8ff', borderBottom: '1px solid #dde6ef' }}>
                  <Box className="window-dot red" />
                  <Box className="window-dot yellow" />
                  <Box className="window-dot green" />
                  <Typography color="text.secondary" fontWeight={800} marginLeft="auto">
                    Pull request #128
                  </Typography>
                </Stack>
                <Box sx={{ p: 3 }}>
                  <Typography color="secondary" fontWeight={800} gutterBottom>
                    ReviewPilot commented
                  </Typography>
                  <Typography variant="h5" fontWeight={850}>
                    Review notes
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 1, mb: 2 }}>
                    I reviewed the latest changes. A couple of things are worth tightening before merge.
                  </Typography>
                  <Alert severity="info" icon={<BugReportIcon />}>
                    <strong>src/payments/checkout.ts:64</strong>
                    <br />
                    Handle the failed payment branch before creating the order so paid and unpaid orders cannot share the same status.
                  </Alert>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Grid container spacing={2.5}>
          <ValueCard icon={<CheckCircleIcon />} title="Built for changed code" text="Reviews stay focused on the diff instead of giving generic advice about the whole repo." />
          <ValueCard icon={<AutoFixHighIcon />} title="Human-readable feedback" text="Comments are written like a teammate: clear, specific, and easy to act on." />
          <ValueCard icon={<SecurityIcon />} title="History included" text="Track reviews, failed runs, repositories, and scores from one simple dashboard." />
        </Grid>
      </Container>

      <Container id="preview" maxWidth="lg" sx={{ pb: 8 }}>
        <Card className="interactive-card">
          <CardContent sx={{ p: { xs: 3, md: 5 } }}>
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={5}>
                <Chip color="primary" label="Interactive preview" sx={{ mb: 2, fontWeight: 800 }} />
                <Typography variant="h3" sx={{ mb: 2 }}>
                  Show prospects what the bot actually catches.
                </Typography>
                <Typography color="text.secondary" lineHeight={1.7}>
                  For ads, people need to understand the value fast. This preview gives them a concrete taste before they sign in.
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 3 }}>
                  {sampleFindings.map((finding, index) => (
                    <Button
                      color={index === activeFinding ? 'primary' : 'inherit'}
                      key={finding.label}
                      onClick={() => setActiveFinding(index)}
                      startIcon={finding.icon}
                      variant={index === activeFinding ? 'contained' : 'outlined'}
                    >
                      {finding.label}
                    </Button>
                  ))}
                </Stack>
              </Grid>
              <Grid item xs={12} md={7}>
                <Card variant="outlined" sx={{ bgcolor: '#ffffff' }}>
                  <CardContent>
                    <Typography color="primary" fontWeight={850}>
                      {sampleFindings[activeFinding].file}
                    </Typography>
                    <Typography sx={{ mt: 1.5 }} lineHeight={1.7}>
                      {sampleFindings[activeFinding].text}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Container>

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Typography variant="h3" sx={{ mb: 2 }}>
          From install to review in minutes
        </Typography>
        <Grid container spacing={2.5}>
          <Step number="1" title="Connect GitHub" text="Sign in and install the GitHub App on selected repositories." />
          <Step number="2" title="Open a PR" text="The webhook queues a review without slowing down GitHub." />
          <Step number="3" title="Review and merge" text="The bot updates one clean PR comment as new commits arrive." />
        </Grid>
      </Container>

      <Container maxWidth="lg" sx={{ pb: 8 }}>
        <Card sx={{ textAlign: 'center', background: 'linear-gradient(135deg, #eaf1ff, #e6f7f1)' }}>
          <CardContent sx={{ p: { xs: 3, md: 6 } }}>
            <Typography variant="h3">Give every pull request a second set of eyes.</Typography>
            <Typography color="text.secondary" sx={{ my: 2 }}>
              Start with your own repositories, then invite teammates when you are ready.
            </Typography>
            <Button href="/auth/github" size="large" startIcon={<GitHubIcon />} variant="contained">
              Login with GitHub
            </Button>
            <Typography color="text.secondary" fontSize={13} sx={{ mt: 2 }}>
              Secure GitHub OAuth sign-in. You can uninstall the GitHub App from GitHub settings at any time.
            </Typography>
          </CardContent>
        </Card>
      </Container>

      <Footer onNavigate={props.onNavigate} />
    </Box>
  );
}

function TermsPage(props: { onNavigate: (path: string) => void }) {
  return (
    <LegalShell title="Terms and Conditions" icon={<ArticleIcon />} onNavigate={props.onNavigate}>
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

function PrivacyPage(props: { onNavigate: (path: string) => void }) {
  return (
    <LegalShell title="Privacy Policy" icon={<PolicyIcon />} onNavigate={props.onNavigate}>
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

function ContactPage(props: { onNavigate: (path: string) => void }) {
  return (
    <LegalShell title="Contact" icon={<EmailIcon />} onNavigate={props.onNavigate}>
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

function LegalShell(props: { title: string; icon: JSX.Element; children: React.ReactNode; onNavigate: (path: string) => void }) {
  return (
    <Box className="landing-bg" sx={{ minHeight: '100vh' }}>
      <AppBar color="transparent" elevation={0} position="sticky" sx={{ backdropFilter: 'blur(14px)', borderBottom: '1px solid #dde6ef' }}>
        <Toolbar sx={{ maxWidth: 1280, width: '100%', mx: 'auto', gap: 2 }}>
          <BrandButton onClick={() => props.onNavigate('/')} />
          <Button color="inherit" onClick={() => props.onNavigate('/terms')}>
            Terms
          </Button>
          <Button color="inherit" onClick={() => props.onNavigate('/privacy')}>
            Privacy
          </Button>
          <Button color="inherit" onClick={() => props.onNavigate('/')}>
            Home
          </Button>
          <Button href="/auth/github" startIcon={<GitHubIcon />} variant="contained">
            Start free
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: { xs: 6, md: 9 } }}>
        <Avatar sx={{ bgcolor: 'primary.main', mb: 2 }}>{props.icon}</Avatar>
        <Typography variant="h2" sx={{ mb: 1 }}>
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
        <Typography variant="h6" fontWeight={850}>
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
    <Box component="footer" sx={{ borderTop: '1px solid #dde6ef', bgcolor: 'rgba(255,255,255,0.72)', py: 4 }}>
      <Container maxWidth="lg">
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <BrandButton onClick={() => props.onNavigate('/')} />
            <Typography color="text.secondary" sx={{ mt: 1 }}>
              AI pull request reviews for faster, calmer code review.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <Button onClick={() => props.onNavigate('/terms')}>Terms</Button>
            <Button onClick={() => props.onNavigate('/privacy')}>Privacy</Button>
            <Button onClick={() => props.onNavigate('/contact')}>Contact</Button>
            <Button href={siteConfig.instagramUrl} rel="noreferrer" startIcon={<InstagramIcon />} target="_blank">
              Instagram
            </Button>
            <Button href={siteConfig.linkedinUrl} rel="noreferrer" startIcon={<LinkedInIcon />} target="_blank">
              LinkedIn
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function DashboardApp(props: { onHome: () => void }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [repos, setRepos] = useState<Repository[]>([]);
  const [setup, setSetup] = useState<SetupInfo | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewDetail | null>(null);
  const [section, setSection] = useState<'overview' | 'inbox' | 'repos' | 'setup'>('overview');
  const [filter, setFilter] = useState<'all' | 'done' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSession();
  }, []);

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
      const [statsResult, reviewsResult, reposResult, setupResult] = await Promise.all([
        fetchJson<{ stats: Stats }>('/api/stats'),
        fetchJson<{ reviews: ReviewListItem[] }>('/api/reviews?limit=30'),
        fetchJson<{ repositories: Repository[] }>('/api/repos'),
        fetchJson<{ setup: SetupInfo }>('/api/setup')
      ]);

      setStats(statsResult.stats);
      setReviews(reviewsResult.reviews);
      setRepos(reposResult.repositories);
      setSetup(setupResult.setup);

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

  async function logout() {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setSelectedReview(null);
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
    return filter === 'all' ? reviews : reviews.filter((review) => review.status === filter);
  }, [filter, reviews]);
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
              <Button href="/auth/github" startIcon={<GitHubIcon />} variant="contained">
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
      <Container
        className="dashboard-shell"
        maxWidth={false}
        sx={{
          width: '100%',
          px: { xs: 2, sm: 3, lg: 4 },
          mx: 0
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'stretch', lg: 'flex-start' }}
          spacing={2}
        >
          <Box>
            <BrandButton onClick={props.onHome} />
            <Typography
              variant="h2"
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
            <Typography fontWeight={800} sx={{ mr: { xs: 0, sm: 1 } }}>{user.username}</Typography>
            <Button onClick={props.onHome} size="small" variant="outlined">
              Home
            </Button>
            <Button onClick={logout} size="small" startIcon={<LogoutIcon />} variant="outlined">
              Logout
            </Button>
          </Stack>
        </Stack>

        {error ? <Alert severity="error" sx={{ mt: 3 }}>{error}</Alert> : null}

        <Card sx={{ mt: 3, width: '100%' }}>
          <CardContent sx={{ pb: 1 }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography variant="h6" fontWeight={900}>
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
              onChange={(_event, value) => setSection(value)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              sx={{ mt: 2 }}
            >
              <Tab icon={<InsightsIcon />} iconPosition="start" label="Overview" value="overview" />
              <Tab icon={<ManageSearchIcon />} iconPosition="start" label="PR Inbox" value="inbox" />
              <Tab icon={<GitHubIcon />} iconPosition="start" label="Repositories" value="repos" />
              <Tab icon={<SettingsIcon />} iconPosition="start" label="Setup" value="setup" />
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
            onOpenInbox={() => setSection('inbox')}
            onOpenSetup={() => setSection('setup')}
          />
        ) : null}
        {section === 'inbox' ? (
          <InboxPanel
            repos={repos}
            filter={filter}
            setFilter={setFilter}
            filteredReviews={filteredReviews}
            selectedReview={selectedReview}
            onRefresh={loadDashboardData}
            onSelectReview={selectReview}
          />
        ) : null}
        {section === 'repos' ? <RepositoriesPanel repos={repos} onRefresh={loadDashboardData} onSaveSettings={saveRepoSettings} /> : null}
        {section === 'setup' ? <SetupPanel repos={repos} setup={setup} stats={stats} onOpenRepos={() => setSection('repos')} /> : null}
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
              <Typography variant="h6" fontWeight={900}>Install on GitHub</Typography>
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
                  <Typography variant="h6" fontWeight={900}>Review health</Typography>
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
              <Typography variant="h6" fontWeight={900}>Latest reviewed PR</Typography>
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
              <Typography variant="h6" fontWeight={850}>Sections</Typography>
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
              {props.repos.slice(0, 6).map((repo) => (
                <ListItemButton key={repo.id} sx={{ borderRadius: 1 }}>
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
              A daily work queue for reviewed pull requests.
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
          <Typography variant="h5" fontWeight={900}>Repositories</Typography>
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
            <Typography variant="h6" fontWeight={900}>Setup checklist</Typography>
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
            <Typography variant="h6" fontWeight={900}>Configuration</Typography>
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

function ReviewDetailCard(props: { selectedReview: ReviewDetail | null }) {
  return (
    <Card>
      <CardContent>
        {props.selectedReview ? (
          <>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
              <Typography variant="h6" fontWeight={850}>Review Detail</Typography>
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
      <Box sx={{ bgcolor: '#f6f8fc', border: '1px solid #e3e9ef', borderRadius: 1, p: 1.5 }}>
        <Typography color="text.secondary" fontSize={12}>{props.label}</Typography>
        <Typography fontWeight={900}>{props.value}</Typography>
      </Box>
    </Grid>
  );
}

function EmptyState(props: { title: string; text: string }) {
  return (
    <Box sx={{ border: '1px dashed #b8c4d2', borderRadius: 1, p: 3, textAlign: 'center' }}>
      <TuneIcon color="action" />
      <Typography fontWeight={900}>{props.title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>{props.text}</Typography>
    </Box>
  );
}

function ConfigRow(props: { label: string; value: string }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} className="setup-row">
      <Typography color="text.secondary">{props.label}</Typography>
      <Typography fontWeight={850}>{props.value}</Typography>
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
          <Typography variant="h4" fontWeight={900}>{props.value}</Typography>
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
      <Typography variant="h6" fontWeight={900}>
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
