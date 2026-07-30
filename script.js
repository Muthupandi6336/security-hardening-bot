/* ============================================================
   Security Posture Auto-Hardening Bot — script.js
   Complete interactive logic: scroll animations, real-time
   scanning simulation, live detection feed, charts, filters,
   one-click fixes, activity ticker, toasts, and more.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  //  AUTHENTICATION & SESSION MANAGEMENT
  // ============================================================

  const token = localStorage.getItem('shieldai_token');
  if (!token) {
    window.location.href = 'login.html';
    return;
  }

  // --- XSS Sanitization helper ---
  function sanitizeHTML(str) {
    if (typeof str !== 'string') return str;
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- JWT Decode (without verification — just for expiry check) ---
  function decodeJWT(token) {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (e) {
      return null;
    }
  }

  // --- Token Auto-Refresh ---
  async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('shieldai_refresh');
    if (!refreshToken) {
      secureLogout();
      return null;
    }
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (!response.ok) {
        secureLogout();
        return null;
      }
      const data = await response.json();
      localStorage.setItem('shieldai_token', data.accessToken);
      return data.accessToken;
    } catch (err) {
      console.error('Token refresh failed:', err);
      return null;
    }
  }

  // --- Authenticated Fetch (auto-refreshes token if expired) ---
  async function authFetch(url, options = {}) {
    let currentToken = localStorage.getItem('shieldai_token');
    options.headers = {
      ...options.headers,
      'Authorization': 'Bearer ' + currentToken,
      'Content-Type': 'application/json'
    };

    let response = await fetch(url, options);

    // If 401 with TOKEN_EXPIRED, try refresh
    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.code === 'TOKEN_EXPIRED') {
        const newToken = await refreshAccessToken();
        if (newToken) {
          options.headers['Authorization'] = 'Bearer ' + newToken;
          response = await fetch(url, options);
        }
      } else {
        secureLogout();
      }
    }
    return response;
  }

  // --- Secure Logout ---
  async function secureLogout() {
    const accessToken = localStorage.getItem('shieldai_token');
    const refreshToken = localStorage.getItem('shieldai_refresh');

    // Call backend to blacklist tokens
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + accessToken
        },
        body: JSON.stringify({ refreshToken })
      });
    } catch (e) {
      // Ignore errors — we're logging out anyway
    }

    // Clear all stored data
    localStorage.removeItem('shieldai_token');
    localStorage.removeItem('shieldai_refresh');
    localStorage.removeItem('shieldai_user');
    localStorage.removeItem('shieldai_role');
    window.location.href = 'login.html';
  }

  // --- Logout Button ---
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to logout?')) {
        secureLogout();
      }
    });
  }

  // --- Session Timer Countdown ---
  const sessionTimerEl = document.getElementById('sessionTimer');
  function updateSessionTimer() {
    const currentToken = localStorage.getItem('shieldai_token');
    if (!currentToken) return;

    const decoded = decodeJWT(currentToken);
    if (!decoded || !decoded.exp) return;

    const now = Math.floor(Date.now() / 1000);
    const remaining = decoded.exp - now;

    if (remaining <= 0) {
      // Token expired — try refresh
      refreshAccessToken();
      return;
    }

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;

    if (sessionTimerEl) {
      sessionTimerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      // Warning when < 2 minutes
      const sessionInfo = document.getElementById('sessionInfo');
      if (sessionInfo) {
        if (remaining < 120) {
          sessionInfo.style.color = '#ff1744';
          // Auto-refresh when < 1 minute
          if (remaining < 60) {
            refreshAccessToken();
          }
        } else {
          sessionInfo.style.color = '';
        }
      }
    }
  }

  // Update timer every second
  setInterval(updateSessionTimer, 1000);
  updateSessionTimer();

  // Auto-refresh token every 12 minutes (token lasts 15min)
  setInterval(refreshAccessToken, 12 * 60 * 1000);


  // F11. REAL-TIME WEBSOCKETS
  const socket = typeof io !== 'undefined' ? io() : null;
  if (socket) {
    socket.on('connect', () => console.log('Connected to Backend via WebSocket'));
    
    // Live Threat Alert
    socket.on('threat-alert', (data) => {
      if (typeof launchAttack === 'function') {
        launchAttack(data.origin, data.target, data.severity);
      }
    });

    // Live Notifications
    socket.on('new-notification', (data) => {
      if (typeof notifications !== 'undefined' && typeof updateBadge === 'function') {
        notifications.unshift({ ...data, id: Date.now(), read: false });
        if (notifications.length > 30) notifications.pop();
        updateBadge();
        if (document.getElementById('notifPanel') && document.getElementById('notifPanel').classList.contains('active')) {
          if (typeof renderNotifications === 'function') renderNotifications();
        }
      }
    });
  }

  /* ----------------------------------------------------------
     1. Scroll Animations (Intersection Observer)
  ---------------------------------------------------------- */
  const animElements = document.querySelectorAll('.anim-fade-up');
  const animObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          animObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  animElements.forEach((el) => animObserver.observe(el));

  /* ----------------------------------------------------------
     2. Navbar Scroll Effect
  ---------------------------------------------------------- */
  const navbar = document.getElementById('navbar');
  const handleNavbarScroll = () => {
    if (!navbar) return;
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  };
  window.addEventListener('scroll', handleNavbarScroll, { passive: true });
  handleNavbarScroll();

  /* ----------------------------------------------------------
     3. Animated Counters
  ---------------------------------------------------------- */
  const statNumbers = document.querySelectorAll('.stat-number');

  const animateCounter = (el) => {
    if (el.dataset.animated === 'true') return;
    el.dataset.animated = 'true';

    const target = parseFloat(el.dataset.target);
    const isDecimal = String(el.dataset.target).includes('.');
    const decimalPlaces = isDecimal
      ? String(el.dataset.target).split('.')[1].length
      : 0;
    const duration = 2000;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress);
      const current = eased * target;
      el.textContent = isDecimal
        ? current.toFixed(decimalPlaces)
        : Math.floor(current).toLocaleString();
      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = isDecimal
          ? target.toFixed(decimalPlaces)
          : target.toLocaleString();
      }
    };
    requestAnimationFrame(step);
  };

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const nums = entry.target.querySelectorAll
            ? entry.target.querySelectorAll('.stat-number')
            : [];
          if (entry.target.classList.contains('stat-number')) {
            animateCounter(entry.target);
          }
          nums.forEach((n) => animateCounter(n));
        }
      });
    },
    { threshold: 0.2 }
  );
  statNumbers.forEach((el) => {
    const section = el.closest('section') || el.parentElement;
    counterObserver.observe(section);
  });

  /* ----------------------------------------------------------
     4. Simulated Real-Time Scanning
  ---------------------------------------------------------- */
  const scanTargets = [
    'AWS IAM Roles & Policies',
    'AWS S3 Bucket Configurations',
    'AWS Security Groups',
    'AWS RDS Instances',
    'AWS Lambda Functions',
    'AWS CloudTrail Logs',
    'Azure Active Directory',
    'Azure Network Security Groups',
    'Azure Storage Accounts',
    'Azure Key Vaults',
    'Azure SQL Databases',
    'GCP IAM Policies',
    'GCP Cloud Storage Buckets',
    'GCP Compute Instances',
    'GCP BigQuery Datasets',
    'GCP Kubernetes Engine',
  ];

  const scanTargetEl = document.getElementById('scanTarget');
  const scanProgressBar = document.getElementById('scanProgressBar');

  const runScanCycle = () => {
    const target = scanTargets[Math.floor(Math.random() * scanTargets.length)];
    if (scanTargetEl) scanTargetEl.textContent = `Scanning: ${target}...`;
    if (scanProgressBar) {
      scanProgressBar.style.transition = 'none';
      scanProgressBar.style.width = '0%';
      // Force reflow
      void scanProgressBar.offsetWidth;
      scanProgressBar.style.transition = 'width 2.8s cubic-bezier(0.4,0,0.2,1)';
      scanProgressBar.style.width = '100%';
    }
  };

  if (scanTargetEl || scanProgressBar) {
    runScanCycle();
    setInterval(runScanCycle, 3000);
  }

  /* ----------------------------------------------------------
     5. Live Detection Feed
  ---------------------------------------------------------- */
  const feedList = document.getElementById('feedList');
  const feedCount = document.getElementById('feedCount');
  let detectionCount = 0;
  const MAX_FEED_ITEMS = 8;

  const svgIcons = {
    critical: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    high: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    medium: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
    low: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>`,
  };

  const sampleDetections = [
    { severity: 'critical', message: 'Public S3 bucket detected with sensitive data', resource: 's3://prod-backups', provider: 'AWS' },
    { severity: 'critical', message: 'Root account used without MFA', resource: 'arn:aws:iam::root', provider: 'AWS' },
    { severity: 'critical', message: 'Database publicly accessible', resource: 'sql-prod-main', provider: 'Azure' },
    { severity: 'high', message: 'SSH port open to 0.0.0.0/0', resource: 'sg-0a1b2c3d', provider: 'AWS' },
    { severity: 'high', message: 'IAM policy allows wildcard actions', resource: 'policy-admin-full', provider: 'AWS' },
    { severity: 'high', message: 'Storage account allows public blob access', resource: 'storageacctprod01', provider: 'Azure' },
    { severity: 'high', message: 'Service account key older than 90 days', resource: 'sa-compute@proj.iam', provider: 'GCP' },
    { severity: 'high', message: 'Network Security Group allows RDP from any', resource: 'nsg-web-tier', provider: 'Azure' },
    { severity: 'medium', message: 'CloudTrail logging disabled in region', resource: 'trail-main', provider: 'AWS' },
    { severity: 'medium', message: 'Key Vault soft-delete not enabled', resource: 'kv-prod-secrets', provider: 'Azure' },
    { severity: 'medium', message: 'GCS bucket has uniform access disabled', resource: 'gs://analytics-data', provider: 'GCP' },
    { severity: 'medium', message: 'Lambda function using outdated runtime', resource: 'fn-data-processor', provider: 'AWS' },
    { severity: 'medium', message: 'BigQuery dataset shared externally', resource: 'dataset-user-events', provider: 'GCP' },
    { severity: 'low', message: 'Missing resource tags on instance', resource: 'i-0abc123def', provider: 'AWS' },
    { severity: 'low', message: 'Unused elastic IP address found', resource: 'eipalloc-0d1e2f3a', provider: 'AWS' },
    { severity: 'low', message: 'VM instance missing labels', resource: 'gce-worker-node-3', provider: 'GCP' },
    { severity: 'low', message: 'Resource group without cost tags', resource: 'rg-staging-apps', provider: 'Azure' },
  ];

  const timeAgoOptions = ['1s ago', '2s ago', '3s ago', '5s ago', '8s ago', '12s ago', '20s ago', '30s ago'];

  const addDetection = () => {
    if (!feedList) return;
    const det = sampleDetections[Math.floor(Math.random() * sampleDetections.length)];
    const timeAgo = timeAgoOptions[Math.floor(Math.random() * timeAgoOptions.length)];

    const item = document.createElement('div');
    item.className = `feed-item severity-${det.severity}`;
    item.innerHTML = `
      <div class="feed-icon ${det.severity}">${svgIcons[det.severity]}</div>
      <div class="feed-content">
        <span class="feed-message">${det.message}</span>
        <span class="feed-meta"><code>${det.resource}</code> · ${det.provider}</span>
      </div>
      <span class="feed-time">${timeAgo}</span>
    `;

    feedList.insertBefore(item, feedList.firstChild);
    detectionCount++;

    // Remove oldest if exceeding max
    while (feedList.children.length > MAX_FEED_ITEMS) {
      feedList.removeChild(feedList.lastChild);
    }

    if (feedCount) feedCount.textContent = detectionCount;
  };

  if (feedList) {
    // Seed with a few initial items
    for (let i = 0; i < 3; i++) {
      addDetection();
    }
    setInterval(addDetection, 4000);
  }

  /* ----------------------------------------------------------
     6. Severity Ring Chart Animation
  ---------------------------------------------------------- */
  const ringSegments = document.querySelectorAll('.ring-segment');
  const ringCircumference = 2 * Math.PI * 85;
  let ringAnimated = false;

  const animateRingChart = () => {
    if (ringAnimated) return;
    ringAnimated = true;

    let cumulativeOffset = 0;

    ringSegments.forEach((seg) => {
      const percent = parseFloat(seg.dataset.percent) || 0;
      const segLength = (percent / 100) * ringCircumference;

      seg.style.strokeDasharray = `${segLength} ${ringCircumference - segLength}`;
      seg.style.strokeDashoffset = `${ringCircumference - cumulativeOffset}`;

      cumulativeOffset += segLength;
    });

    // Animate ring total counter
    const ringTotal = document.querySelector('.ring-total');
    if (ringTotal) {
      const target = parseFloat(ringTotal.dataset.target || ringTotal.textContent) || 0;
      const duration = 2000;
      const start = performance.now();
      const step = (now) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - (1 - progress) * (1 - progress);
        ringTotal.textContent = Math.floor(eased * target);
        if (progress < 1) requestAnimationFrame(step);
        else ringTotal.textContent = target;
      };
      requestAnimationFrame(step);
    }
  };

  if (ringSegments.length > 0) {
    const ringSection = ringSegments[0].closest('section') || ringSegments[0].closest('.severity-chart') || ringSegments[0].parentElement;
    const ringObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateRingChart();
            ringObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );
    if (ringSection) ringObserver.observe(ringSection);
  }

  /* ----------------------------------------------------------
     7. Progress Bar Animations
  ---------------------------------------------------------- */
  const progressFills = document.querySelectorAll('.progress-fill, .comp-bar-fill');

  const animateProgressBar = (el) => {
    if (el.dataset.animated === 'true') return;
    el.dataset.animated = 'true';
    const targetWidth = el.dataset.width || '0';
    el.style.width = '0%';
    // Force reflow
    void el.offsetWidth;
    el.style.width = `${targetWidth}%`;
  };

  const progressObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Animate this element directly if it matches
          if (entry.target.classList.contains('progress-fill') || entry.target.classList.contains('comp-bar-fill')) {
            animateProgressBar(entry.target);
          }
          // Also search children
          entry.target.querySelectorAll('.progress-fill, .comp-bar-fill').forEach((bar) => {
            animateProgressBar(bar);
          });
          progressObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  progressFills.forEach((el) => {
    const section = el.closest('section') || el.parentElement;
    progressObserver.observe(section);
  });

  /* ----------------------------------------------------------
     8. Donut Chart Animation
  ---------------------------------------------------------- */
  const donutCircumference = 2 * Math.PI * 85;
  const donutFills = document.querySelectorAll('.donut-fill');

  const animateDonut = (circle) => {
    if (circle.dataset.animated === 'true') return;
    circle.dataset.animated = 'true';

    const percent = parseFloat(circle.dataset.percent) || 0;
    const targetOffset = donutCircumference - (percent / 100) * donutCircumference;

    circle.style.strokeDasharray = `${donutCircumference}`;
    circle.style.strokeDashoffset = `${donutCircumference}`;
    // Force reflow
    void circle.getBBox();

    requestAnimationFrame(() => {
      circle.style.transition = 'stroke-dashoffset 1.5s cubic-bezier(0.4,0,0.2,1)';
      circle.style.strokeDashoffset = `${targetOffset}`;
    });

    // Animate corresponding donut value counter
    const container = circle.closest('.donut-container') || circle.parentElement.parentElement;
    if (container) {
      const valueEl = container.querySelector('.donut-value');
      if (valueEl && valueEl.dataset.animated !== 'true') {
        valueEl.dataset.animated = 'true';
        const valTarget = parseFloat(valueEl.dataset.target || valueEl.textContent) || percent;
        const duration = 1500;
        const startTime = performance.now();
        const step = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - (1 - progress) * (1 - progress);
          valueEl.textContent = Math.floor(eased * valTarget);
          if (progress < 1) requestAnimationFrame(step);
          else valueEl.textContent = valTarget;
        };
        requestAnimationFrame(step);
      }
    }
  };

  const donutObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll('.donut-fill').forEach((c) => animateDonut(c));
          if (entry.target.classList.contains('donut-fill')) {
            animateDonut(entry.target);
          }
          donutObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  donutFills.forEach((circle) => {
    const section = circle.closest('section') || circle.parentElement;
    donutObserver.observe(section);
  });

  /* ----------------------------------------------------------
     9. Detection Table Filters
  ---------------------------------------------------------- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const tableRows = document.querySelectorAll('.table-row');

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Toggle active state
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      tableRows.forEach((row) => {
        if (filter === 'all' || row.dataset.severity === filter) {
          row.classList.remove('hidden');
        } else {
          row.classList.add('hidden');
        }
      });
    });
  });

  /* ----------------------------------------------------------
     10. One-Click Fix Buttons
  ---------------------------------------------------------- */
  const fixBtns = document.querySelectorAll('.fix-btn');

  const spinnerSvg = `<svg class="spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>`;

  fixBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;

      const row = btn.closest('.table-row');
      const originalText = btn.textContent;

      // Phase 1: Fixing...
      btn.innerHTML = `${spinnerSvg} Fixing...`;
      btn.classList.add('fixing');
      if (row) row.classList.add('fixing');

      // Show fix tooltip if present
      const tooltip = row ? row.querySelector('.fix-tooltip') : null;
      if (tooltip) {
        tooltip.classList.add('visible');
      }

      // Phase 2: Fixed after 2 seconds
      setTimeout(() => {
        btn.innerHTML = '✓ Fixed';
        btn.disabled = true;
        btn.classList.remove('fixing');
        btn.classList.add('fix-applied');

        if (row) {
          row.classList.remove('fixing');
          row.classList.add('fixed-anim');

          const badge = row.querySelector('.status-badge');
          if (badge) {
            badge.textContent = 'Fixed ✓';
            badge.classList.add('fixed');
          }
        }

        if (tooltip) {
          tooltip.classList.remove('visible');
        }
      }, 2000);
    });
  });

  /* ----------------------------------------------------------
     11. Activity Ticker
  ---------------------------------------------------------- */
  const activityTicker = document.getElementById('activityTicker');

  const activityIcons = {
    scan: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    detect: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    fix: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    alert: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };

  const activityTemplates = [
    { type: 'scan', text: 'Completed full scan of AWS IAM Roles & Policies' },
    { type: 'scan', text: 'Completed full scan of Azure Active Directory' },
    { type: 'scan', text: 'Completed full scan of GCP Cloud Storage Buckets' },
    { type: 'detect', text: 'Detected public S3 bucket in s3://prod-backups' },
    { type: 'detect', text: 'Detected open SSH port in sg-0a1b2c3d' },
    { type: 'detect', text: 'Detected unencrypted RDS instance in db-analytics' },
    { type: 'fix', text: 'Auto-remediated public access on s3://prod-backups' },
    { type: 'fix', text: 'Auto-remediated open SSH port on sg-0a1b2c3d' },
    { type: 'fix', text: 'Auto-remediated missing encryption on kv-prod-secrets' },
    { type: 'alert', text: 'Critical alert: Root login attempt on arn:aws:iam::root' },
    { type: 'alert', text: 'Critical alert: Unusual data transfer on gs://analytics-data' },
    { type: 'alert', text: 'Critical alert: Privilege escalation on sa-compute@proj.iam' },
  ];

  const activityTimes = [
    '1m ago', '2m ago', '3m ago', '5m ago', '7m ago', '8m ago',
    '10m ago', '12m ago', '15m ago', '18m ago', '22m ago', '30m ago',
  ];

  const activityTypeLabels = {
    scan: 'Scan',
    detect: 'Detect',
    fix: 'Fix',
    alert: 'Alert',
  };

  if (activityTicker) {
    const fragment = document.createDocumentFragment();

    for (let i = 0; i < 12; i++) {
      const template = activityTemplates[i % activityTemplates.length];
      const time = activityTimes[i];

      const item = document.createElement('div');
      item.className = 'activity-item';
      item.innerHTML = `
        <div class="activity-icon ${template.type}">${activityIcons[template.type]}</div>
        <span class="activity-text">${template.text}</span>
        <span class="activity-time">${time}</span>
        <span class="activity-action action-${template.type}">${activityTypeLabels[template.type]}</span>
      `;
      fragment.appendChild(item);
    }

    activityTicker.appendChild(fragment);
  }

  /* ----------------------------------------------------------
     12. Download / Schedule Report — Toast Notifications
  ---------------------------------------------------------- */
  const downloadReportBtn = document.getElementById('downloadReport');
  const scheduleReportBtn = document.getElementById('scheduleReport');

  const showToast = (message) => {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00e676"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
      </svg>
      <span>${message}</span>
    `;
    toast.style.cssText = `
      position: fixed;
      bottom: 32px;
      right: 32px;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 24px;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 14px;
      color: #e2e8f0;
      font-size: 0.95rem;
      font-family: inherit;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      z-index: 10000;
      animation: toastSlideIn 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.35s cubic-bezier(0.4, 0, 1, 1) forwards';
      toast.addEventListener('animationend', () => toast.remove());
    }, 3000);
  };

  // Inject toast keyframes once
  const toastStyleSheet = document.createElement('style');
  toastStyleSheet.textContent = `
    @keyframes toastSlideIn {
      from { opacity: 0; transform: translateY(20px) scale(0.95); }
      to   { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes toastSlideOut {
      from { opacity: 1; transform: translateY(0) scale(1); }
      to   { opacity: 0; transform: translateY(20px) scale(0.95); }
    }
  `;
  document.head.appendChild(toastStyleSheet);

  if (downloadReportBtn) {
    downloadReportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Report downloaded successfully');
    });
  }

  if (scheduleReportBtn) {
    scheduleReportBtn.addEventListener('click', (e) => {
      e.preventDefault();
      showToast('Weekly report scheduled for every Monday 9:00 AM');
    });
  }

  /* ----------------------------------------------------------
     13. Smooth Scroll Navigation
  ---------------------------------------------------------- */
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;

      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const navbarHeight = navbar ? navbar.offsetHeight : 80;
      const targetPosition = target.getBoundingClientRect().top + window.scrollY - navbarHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });
    });
  });

  /* ----------------------------------------------------------
     14. Mobile Navigation Toggle
  ---------------------------------------------------------- */
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      navToggle.classList.toggle('active');
      navLinks.classList.toggle('active');
    });

    // Close menu when a nav link is clicked
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navLinks.classList.remove('active');
      });
    });
  }

  /* ----------------------------------------------------------
     15. Parallax Effect on Gradient Orbs
  ---------------------------------------------------------- */
  const hero = document.querySelector('.hero');

  if (hero) {
    const orbs = hero.querySelectorAll('.gradient-orb, .hero-orb, .orb');
    let mouseX = 0;
    let mouseY = 0;
    let currentX = 0;
    let currentY = 0;
    let rafId = null;

    const handleMouseMove = (e) => {
      const rect = hero.getBoundingClientRect();
      mouseX = (e.clientX - rect.left - rect.width / 2) / 40;
      mouseY = (e.clientY - rect.top - rect.height / 2) / 40;

      if (!rafId) {
        rafId = requestAnimationFrame(updateOrbPositions);
      }
    };

    const updateOrbPositions = () => {
      // Smooth lerp
      currentX += (mouseX - currentX) * 0.1;
      currentY += (mouseY - currentY) * 0.1;

      orbs.forEach((orb, i) => {
        const factor = (i % 2 === 0) ? 1 : -1;
        const depth = 1 + (i * 0.5);
        const tx = currentX * depth * factor;
        const ty = currentY * depth * factor;
        orb.style.transform = `translate(${tx}px, ${ty}px)`;
      });

      // Continue animation if there's still meaningful delta
      if (
        Math.abs(mouseX - currentX) > 0.01 ||
        Math.abs(mouseY - currentY) > 0.01
      ) {
        rafId = requestAnimationFrame(updateOrbPositions);
      } else {
        rafId = null;
      }
    };

    hero.addEventListener('mousemove', handleMouseMove, { passive: true });
  }

  /* ----------------------------------------------------------
     Bonus: Keyboard accessibility — Enter/Space on buttons
  ---------------------------------------------------------- */
  document.querySelectorAll('.fix-btn, .filter-btn').forEach((btn) => {
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });

  /* ----------------------------------------------------------
     16. COMPANY SETUP MODAL
  ---------------------------------------------------------- */
  const setupModal = document.getElementById('setupModal');
  const setupForm = document.getElementById('setupForm');
  const settingsBtn = document.getElementById('settingsBtn');
  const setupCloseBtn = document.getElementById('setupCloseBtn');
  const setupCancelBtn = document.getElementById('setupCancelBtn');
  const heroSetupBtn = document.getElementById('heroSetupBtn');
  const heroBadgeText = document.getElementById('heroBadgeText');
  const heroCta = document.getElementById('heroCta');
  const navCta = document.getElementById('navCta');

  // Provider checkbox toggles — show/hide provider-specific fields
  const providerFieldsMap = {
    aws: { checkbox: document.getElementById('providerAws'), fields: document.getElementById('awsFields') },
    azure: { checkbox: document.getElementById('providerAzure'), fields: document.getElementById('azureFields') },
    gcp: { checkbox: document.getElementById('providerGcp'), fields: document.getElementById('gcpFields') }
  };

  Object.values(providerFieldsMap).forEach(({ checkbox, fields }) => {
    if (checkbox && fields) {
      checkbox.addEventListener('change', () => {
        fields.style.display = checkbox.checked ? 'block' : 'none';
      });
    }
  });

  function openSetupModal() {
    if (setupModal) {
      setupModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeSetupModal() {
    if (setupModal) {
      setupModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  // Open modal triggers
  if (settingsBtn) settingsBtn.addEventListener('click', openSetupModal);
  if (setupCloseBtn) setupCloseBtn.addEventListener('click', closeSetupModal);
  if (setupCancelBtn) setupCancelBtn.addEventListener('click', closeSetupModal);

  if (heroSetupBtn) {
    heroSetupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const config = loadConfig();
      if (config) {
        // Already configured — scroll to dashboard
        const dashboard = document.getElementById('dashboard');
        if (dashboard) {
          const offset = 80;
          const top = dashboard.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      } else {
        openSetupModal();
      }
    });
  }

  // Close on overlay click
  if (setupModal) {
    setupModal.addEventListener('click', (e) => {
      if (e.target === setupModal) closeSetupModal();
    });
  }

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && setupModal && setupModal.classList.contains('active')) {
      closeSetupModal();
    }
  });

  // Save config to localStorage and backend
  function saveConfig(config) {
    localStorage.setItem('shieldai_config', JSON.stringify(config));
    if (typeof socket !== 'undefined' && socket) {
      socket.emit('update-config', config);
    }
  }

  // Load config from localStorage
  function loadConfig() {
    const data = localStorage.getItem('shieldai_config');
    return data ? JSON.parse(data) : null;
  }

  // Calculate resource count from IPs + cloud services
  function calcResourceCount(config) {
    const ipCount = config.ipAddresses ? config.ipAddresses.split(',').filter(ip => ip.trim()).length : 0;
    let cloudMultiplier = 0;
    if (config.providers) {
      if (config.providers.includes('aws')) cloudMultiplier += 45;
      if (config.providers.includes('azure')) cloudMultiplier += 38;
      if (config.providers.includes('gcp')) cloudMultiplier += 32;
    }
    // Each IP represents ~6 scannable endpoints (ports, services, configs)
    return Math.max(ipCount * 6 + cloudMultiplier, ipCount || 1);
  }

  // Apply config to dashboard — updates all dynamic elements
  function applyConfig(config) {
    const resourceCount = calcResourceCount(config);
    const fixedCount = Math.floor(resourceCount * 0.12);

    // Update hero badge
    if (heroBadgeText) {
      heroBadgeText.textContent = 'Actively Protecting ' + resourceCount.toLocaleString() + ' Resources — ' + config.companyName;
    }

    // Update hero CTA button text
    if (heroCta) {
      heroCta.textContent = 'Launch Dashboard';
    }

    // Update nav CTA text
    if (navCta) {
      navCta.textContent = config.companyName + ' Console';
    }

    // Update stat counters with real values
    const statResources = document.getElementById('statResources');
    const statFixed = document.getElementById('statFixed');
    if (statResources) {
      statResources.dataset.target = resourceCount;
      statResources.dataset.animated = 'false';
    }
    if (statFixed) {
      statFixed.dataset.target = fixedCount;
      statFixed.dataset.animated = 'false';
    }

    // Re-trigger counter animation
    statNumbers.forEach((el) => {
      if (el.id === 'statResources' || el.id === 'statFixed') {
        el.dataset.animated = 'false';
        el.textContent = '0';
        const section = el.closest('.hero');
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top < window.innerHeight && rect.bottom > 0) {
            animateCounter(el);
          }
        }
      }
    });

    // Show/hide provider cards based on selection
    const providerCards = document.querySelectorAll('.provider-card');
    providerCards.forEach((card) => {
      const provider = card.dataset.provider;
      if (config.providers && config.providers.length > 0) {
        card.style.display = config.providers.includes(provider) ? '' : 'none';
      } else {
        card.style.display = '';
      }
    });

    // Adjust provider grid columns
    const providerGrid = document.querySelector('.provider-grid');
    if (providerGrid && config.providers) {
      const count = config.providers.length || 3;
      if (count === 1) {
        providerGrid.style.gridTemplateColumns = '1fr';
        providerGrid.style.maxWidth = '500px';
        providerGrid.style.margin = '0 auto';
      } else if (count === 2) {
        providerGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        providerGrid.style.maxWidth = '900px';
        providerGrid.style.margin = '0 auto';
      } else {
        providerGrid.style.gridTemplateColumns = '';
        providerGrid.style.maxWidth = '';
        providerGrid.style.margin = '';
      }
    }
  }

  // Handle form submission
  if (setupForm) {
    setupForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const config = {
        companyName: document.getElementById('companyName').value.trim(),
        ipAddresses: document.getElementById('ipAddresses').value.trim(),
        providers: [],
        scanFrequency: document.getElementById('scanFrequency').value,
        autoFix: document.getElementById('autoFix').value,
        aws: {},
        azure: {},
        gcp: {},
        discordWebhook: document.getElementById('discordWebhook') ? document.getElementById('discordWebhook').value.trim() : '',
        slackWebhook: document.getElementById('slackWebhook') ? document.getElementById('slackWebhook').value.trim() : ''
      };

      // Collect selected providers and their config
      if (document.getElementById('providerAws').checked) {
        config.providers.push('aws');
        config.aws = {
          roleArn: document.getElementById('awsRoleArn').value.trim(),
          region: document.getElementById('awsRegion').value,
          accessKey: document.getElementById('awsAccessKey').value.trim()
        };
      }
      if (document.getElementById('providerAzure').checked) {
        config.providers.push('azure');
        config.azure = {
          subscriptionId: document.getElementById('azureSubId').value.trim(),
          tenantId: document.getElementById('azureTenantId').value.trim()
        };
      }
      if (document.getElementById('providerGcp').checked) {
        config.providers.push('gcp');
        config.gcp = {
          projectId: document.getElementById('gcpProjectId').value.trim(),
          serviceAccount: document.getElementById('gcpServiceAccount').value.trim()
        };
      }

      if (!config.companyName) {
        alert('Please enter your company name.');
        return;
      }

      saveConfig(config);
      applyConfig(config);
      closeSetupModal();

      // Show success toast
      showToast('\u2705 ' + config.companyName + ' environment configured! Scanning ' + calcResourceCount(config) + ' resources...');
    });
  }

  // Load saved config on page load
  const savedConfig = loadConfig();
  if (savedConfig) {
    applyConfig(savedConfig);
    if (typeof socket !== 'undefined' && socket) {
      socket.emit('update-config', savedConfig);
    }

    // Pre-fill form fields from saved config
    const companyNameInput = document.getElementById('companyName');
    if (companyNameInput) companyNameInput.value = savedConfig.companyName || '';
    const ipInput = document.getElementById('ipAddresses');
    if (ipInput) ipInput.value = savedConfig.ipAddresses || '';

    if (savedConfig.providers) {
      savedConfig.providers.forEach((p) => {
        const cbId = 'provider' + p.charAt(0).toUpperCase() + p.slice(1);
        const cb = document.getElementById(cbId);
        if (cb) {
          cb.checked = true;
          const fields = document.getElementById(p + 'Fields');
          if (fields) fields.style.display = 'block';
        }
      });
    }

    // Restore AWS fields
    if (savedConfig.aws && savedConfig.aws.roleArn) {
      const el = document.getElementById('awsRoleArn');
      if (el) el.value = savedConfig.aws.roleArn;
    }
    if (savedConfig.aws && savedConfig.aws.region) {
      const el = document.getElementById('awsRegion');
      if (el) el.value = savedConfig.aws.region;
    }
    // Restore Azure fields
    if (savedConfig.azure && savedConfig.azure.subscriptionId) {
      const el = document.getElementById('azureSubId');
      if (el) el.value = savedConfig.azure.subscriptionId;
    }
    if (savedConfig.azure && savedConfig.azure.tenantId) {
      const el = document.getElementById('azureTenantId');
      if (el) el.value = savedConfig.azure.tenantId;
    }
    // Restore GCP fields
    if (savedConfig.gcp && savedConfig.gcp.projectId) {
      const el = document.getElementById('gcpProjectId');
      if (el) el.value = savedConfig.gcp.projectId;
    }
    if (savedConfig.gcp && savedConfig.gcp.serviceAccount) {
      const el = document.getElementById('gcpServiceAccount');
      if (el) el.value = savedConfig.gcp.serviceAccount;
    }
    const sf = document.getElementById('scanFrequency');
    if (sf && savedConfig.scanFrequency) sf.value = savedConfig.scanFrequency;
    const af = document.getElementById('autoFix');
    if (af && savedConfig.autoFix) af.value = savedConfig.autoFix;
    
    // Restore webhooks
    const discordWh = document.getElementById('discordWebhook');
    if (discordWh && savedConfig.discordWebhook) discordWh.value = savedConfig.discordWebhook;
    const slackWh = document.getElementById('slackWebhook');
    if (slackWh && savedConfig.slackWebhook) slackWh.value = savedConfig.slackWebhook;
  } else {
    // No config — first visit, show setup prompt after 2 seconds
    setTimeout(() => {
      openSetupModal();
    }, 2000);
  }

  /* ============================================================
     NEW FEATURES — 9 FEATURE MEGA BUILD (JavaScript)
     ============================================================ */

  /* ----------------------------------------------------------
     F1. LIGHT / DARK THEME TOGGLE
  ---------------------------------------------------------- */
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const savedTheme = localStorage.getItem('shieldai_theme');
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
    } else if (!savedTheme && window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.body.classList.add('light-theme');
    }
    themeToggle.addEventListener('click', () => {
      document.body.classList.add('theme-transitioning');
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('shieldai_theme', isLight ? 'light' : 'dark');
      setTimeout(() => document.body.classList.remove('theme-transitioning'), 500);
    });
  }

  /* ----------------------------------------------------------
     F2. NOTIFICATION CENTER
  ---------------------------------------------------------- */
  const notifBtn = document.getElementById('notifBtn');
  const notifPanel = document.getElementById('notifPanel');
  const notifOverlay = document.getElementById('notifOverlay');
  const notifCloseBtn = document.getElementById('notifCloseBtn');
  const notifMarkAll = document.getElementById('notifMarkAll');
  const notifList = document.getElementById('notifList');
  const notifBadge = document.getElementById('notifBadge');
  const notifEmpty = document.getElementById('notifEmpty');

  const notifTemplates = [
    { type: 'critical', title: 'Critical: Unrestricted DB Access', message: 'Security group prod-db-sg allows 0.0.0.0/0 on port 3306. Immediate action required.' },
    { type: 'critical', title: 'Public S3 Bucket Detected', message: 'Bucket s3://client-data has public read access enabled. Data exposure risk.' },
    { type: 'critical', title: 'Root Account Login Detected', message: 'AWS root account was used to sign in from IP 203.0.113.42.' },
    { type: 'warning', title: 'SSL Certificate Expiring', message: 'Certificate for api.example.com expires in 7 days. Auto-renewal scheduled.' },
    { type: 'warning', title: 'IAM Key Rotation Needed', message: 'Access key AKIA****3F7Q has not been rotated in 87 days.' },
    { type: 'warning', title: 'Unusual API Call Pattern', message: 'Spike in DescribeInstances calls from role lambda-processor-role.' },
    { type: 'info', title: 'Scan Complete: AWS US-East', message: 'Scanned 1,247 resources. 3 new issues found, 2 auto-remediated.' },
    { type: 'info', title: 'Policy Update Applied', message: 'CIS Benchmark v1.5 policy rules have been updated across all regions.' },
    { type: 'info', title: 'Auto-Fix: S3 Logging Enabled', message: 'Access logging automatically enabled for 4 S3 buckets.' },
    { type: 'info', title: 'Weekly Report Generated', message: 'Your weekly security compliance report is ready for download.' },
  ];

  let notifications = [];
  let notifIdCounter = 0;

  function createNotification(templateIdx) {
    const tmpl = notifTemplates[templateIdx !== undefined ? templateIdx : Math.floor(Math.random() * notifTemplates.length)];
    const now = new Date();
    return {
      id: ++notifIdCounter,
      type: tmpl.type,
      title: tmpl.title,
      message: tmpl.message,
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false
    };
  }

  // Seed initial notifications
  for (let i = 0; i < 5; i++) notifications.push(createNotification(i));

  function renderNotifications(filter = 'all') {
    if (!notifList) return;
    const filtered = filter === 'all' ? notifications : notifications.filter(n => n.type === filter);
    if (filtered.length === 0) {
      notifList.innerHTML = '';
      if (notifEmpty) notifEmpty.style.display = 'flex';
      return;
    }
    if (notifEmpty) notifEmpty.style.display = 'none';
    notifList.innerHTML = filtered.map(n => `
      <div class="notif-item ${n.type} ${n.read ? '' : 'unread'}" data-id="${n.id}">
        <div class="notif-item-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${n.type === 'critical' ? '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' : 
              n.type === 'warning' ? '<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>' :
              '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'}
          </svg>
        </div>
        <div class="notif-item-content">
          <div class="notif-item-title">${n.title}</div>
          <div class="notif-item-message">${n.message}</div>
          <div class="notif-item-time">${n.time}</div>
        </div>
        ${n.read ? '' : '<div class="unread-dot"></div>'}
      </div>
    `).join('');

    notifList.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = parseInt(item.dataset.id);
        const notif = notifications.find(n => n.id === id);
        if (notif) { notif.read = true; updateBadge(); renderNotifications(getCurrentNotifFilter()); }
      });
    });
  }

  function updateBadge() {
    const unread = notifications.filter(n => !n.read).length;
    if (notifBadge) { notifBadge.textContent = unread > 0 ? unread : ''; notifBadge.setAttribute('data-count', unread); }
  }

  function getCurrentNotifFilter() {
    const active = document.querySelector('.notif-tab-btn.active');
    return active ? active.dataset.notifFilter : 'all';
  }

  function toggleNotifPanel(open) {
    if (notifPanel) notifPanel.classList.toggle('active', open);
    if (notifOverlay) notifOverlay.classList.toggle('active', open);
  }

  if (notifBtn) notifBtn.addEventListener('click', () => { toggleNotifPanel(true); renderNotifications(); });
  if (notifCloseBtn) notifCloseBtn.addEventListener('click', () => toggleNotifPanel(false));
  if (notifOverlay) notifOverlay.addEventListener('click', () => toggleNotifPanel(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleNotifPanel(false); });

  if (notifMarkAll) notifMarkAll.addEventListener('click', () => {
    notifications.forEach(n => n.read = true);
    updateBadge();
    renderNotifications(getCurrentNotifFilter());
  });

  document.querySelectorAll('.notif-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.notif-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderNotifications(btn.dataset.notifFilter);
    });
  });

  // WebSockets will now handle auto-adding notifications
  // The local interval has been removed.

  renderNotifications();
  updateBadge();

  /* ----------------------------------------------------------
     F3. THREAT MAP — Live Attack Visualization
  ---------------------------------------------------------- */
  const attackLinesGroup = document.getElementById('attackLinesGroup');
  const blockedAttacksEl = document.getElementById('blockedAttacks');
  const activeThreatsEl = document.getElementById('activeThreats');

  const attackOrigins = [
    { name: 'Moscow', x: 720, y: 120 },
    { name: 'Beijing', x: 940, y: 170 },
    { name: 'Pyongyang', x: 970, y: 195 },
    { name: 'Tehran', x: 740, y: 210 },
    { name: 'São Paulo', x: 350, y: 400 }
  ];
  const infraTargets = [
    { name: 'US-East', x: 280, y: 180 },
    { name: 'EU-West', x: 560, y: 140 },
    { name: 'AP-South', x: 880, y: 280 }
  ];

  let blockedCount = 12000 + Math.floor(Math.random() * 3000);

  function launchAttack(inOrigin, inTarget, inSeverity) {
    if (!attackLinesGroup) return;

    let origin = inOrigin || attackOrigins[Math.floor(Math.random() * attackOrigins.length)];
    let target = inTarget || infraTargets[Math.floor(Math.random() * infraTargets.length)];
    const severity = inSeverity || ['critical', 'high', 'medium'][Math.floor(Math.random() * 3)];

    // Convert real-world Lat/Lon to SVG Coordinates if provided
    if (origin.lat !== undefined && origin.lon !== undefined) {
      origin.x = 50 + ((origin.lon + 180) / 360) * 1100;
      origin.y = ((90 - origin.lat) / 180) * 600;
    }
    if (target.lat !== undefined && target.lon !== undefined) {
      target.x = 50 + ((target.lon + 180) / 360) * 1100;
      target.y = ((90 - target.lat) / 180) * 600;
    }

    const midX = (origin.x + target.x) / 2;
    const midY = Math.min(origin.y, target.y) - 40 - Math.random() * 60;

    // 1. Draw the attack line
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M${origin.x},${origin.y} Q${midX},${midY} ${target.x},${target.y}`);
    path.setAttribute('class', `attack-line ${severity}`);
    path.setAttribute('stroke-dasharray', '600');
    path.setAttribute('stroke-dashoffset', '600');
    path.style.animation = 'attackFlow 2.5s ease forwards';
    attackLinesGroup.appendChild(path);

    // 2. Add jumping signal head (comet dot)
    const signal = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    signal.setAttribute('r', '4');
    signal.setAttribute('fill', severity === 'critical' ? '#ff1744' : severity === 'high' ? '#ff9100' : '#ffea00');
    signal.style.filter = 'drop-shadow(0 0 8px currentColor)';
    signal.style.offsetPath = `path('M${origin.x},${origin.y} Q${midX},${midY} ${target.x},${target.y}')`;
    signal.style.animation = 'signalJump 2.5s ease forwards';
    attackLinesGroup.appendChild(signal);

    // 3. Add radar ping at origin
    const originPing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    originPing.setAttribute('cx', origin.x);
    originPing.setAttribute('cy', origin.y);
    originPing.setAttribute('r', '2');
    originPing.setAttribute('class', 'radar-ping');
    attackLinesGroup.appendChild(originPing);

    // 4. Add radar ping at target after delay (when signal hits)
    setTimeout(() => {
      const targetPing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      targetPing.setAttribute('cx', target.x);
      targetPing.setAttribute('cy', target.y);
      targetPing.setAttribute('r', '2');
      targetPing.setAttribute('class', `radar-ping target-ping-${severity}`);
      attackLinesGroup.appendChild(targetPing);
      setTimeout(() => targetPing.remove(), 1500);
    }, 2200);

    blockedCount += Math.floor(Math.random() * 5) + 1;
    if (blockedAttacksEl) blockedAttacksEl.textContent = blockedCount.toLocaleString();
    if (activeThreatsEl) activeThreatsEl.textContent = Math.floor(Math.random() * 5) + 3;

    setTimeout(() => { 
      path.style.opacity = '0'; 
      signal.style.opacity = '0';
      setTimeout(() => {
        path.remove();
        signal.remove();
        originPing.remove();
      }, 500); 
    }, 3000);
  }

  if (attackLinesGroup) {
    // Local interval removed. Attack lines are drawn by WebSockets via socket.on('threat-alert')
  }

  // Counter increment
  setInterval(() => {
    blockedCount += Math.floor(Math.random() * 3) + 1;
    if (blockedAttacksEl) blockedAttacksEl.textContent = blockedCount.toLocaleString();
  }, 1000);

  /* ----------------------------------------------------------
     F4. SECURITY SCORE TIMELINE — Canvas Chart
  ---------------------------------------------------------- */
  const scoreCanvas = document.getElementById('scoreChart');
  const chartTooltip = document.getElementById('chartTooltip');
  const tooltipDate = document.getElementById('tooltipDate');
  const tooltipScore = document.getElementById('tooltipScore');

  let scoreData = [];
  let currentRange = 30;

  function generateScoreData(days) {
    const data = [];
    const now = new Date();
    let score = 65 + Math.random() * 10;
    for (let i = days; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      score += (Math.random() - 0.35) * 4;
      score = Math.max(60, Math.min(99, score));
      if (i < days * 0.3) score = Math.max(score, 85 + Math.random() * 8);
      data.push({ date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), score: Math.round(score * 10) / 10 });
    }
    return data;
  }

  function drawChart(data) {
    if (!scoreCanvas) return;
    const ctx = scoreCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = scoreCanvas.parentElement.getBoundingClientRect();
    scoreCanvas.width = rect.width * dpr;
    scoreCanvas.height = 280 * dpr;
    scoreCanvas.style.width = rect.width + 'px';
    scoreCanvas.style.height = '280px';
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 280;
    const pad = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    ctx.clearRect(0, 0, w, h);

    const minScore = Math.floor(Math.min(...data.map(d => d.score)) / 5) * 5;
    const maxScore = Math.ceil(Math.max(...data.map(d => d.score)) / 5) * 5;
    const range = maxScore - minScore || 10;

    // Grid lines
    const isLight = document.body.classList.contains('light-theme');
    ctx.strokeStyle = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 6]);
    for (let i = 0; i <= 5; i++) {
      const y = pad.top + (chartH / 5) * i;
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
      ctx.fillStyle = isLight ? '#94a3b8' : '#666';
      ctx.font = '11px Inter';
      ctx.textAlign = 'right';
      ctx.fillText((maxScore - (range / 5) * i).toFixed(0), pad.left - 8, y + 4);
    }
    ctx.setLineDash([]);

    // Date labels
    const step = Math.max(1, Math.floor(data.length / 8));
    ctx.fillStyle = isLight ? '#94a3b8' : '#666';
    ctx.font = '10px Inter';
    ctx.textAlign = 'center';
    data.forEach((d, i) => {
      if (i % step === 0) {
        const x = pad.left + (i / (data.length - 1)) * chartW;
        ctx.fillText(d.date, x, h - pad.bottom + 20);
      }
    });

    // Gradient fill
    const grad = ctx.createLinearGradient(0, pad.top, 0, h - pad.bottom);
    grad.addColorStop(0, 'rgba(76, 201, 240, 0.25)');
    grad.addColorStop(1, 'rgba(76, 201, 240, 0)');

    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * chartW;
      const y = pad.top + chartH - ((d.score - minScore) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(pad.left + chartW, h - pad.bottom);
    ctx.lineTo(pad.left, h - pad.bottom);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    const lineGrad = ctx.createLinearGradient(pad.left, 0, w - pad.right, 0);
    lineGrad.addColorStop(0, '#4cc9f0');
    lineGrad.addColorStop(0.5, '#7209b7');
    lineGrad.addColorStop(1, '#f72585');
    ctx.beginPath();
    data.forEach((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * chartW;
      const y = pad.top + chartH - ((d.score - minScore) / range) * chartH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Dots
    data.forEach((d, i) => {
      const x = pad.left + (i / (data.length - 1)) * chartW;
      const y = pad.top + chartH - ((d.score - minScore) / range) * chartH;
      if (data.length <= 30 || i % Math.max(1, Math.floor(data.length / 20)) === 0) {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#4cc9f0';
        ctx.fill();
      }
    });

    // Update stats
    const current = data[data.length - 1].score;
    const first = data[0].score;
    const change = ((current - first) / first * 100).toFixed(1);
    const best = Math.max(...data.map(d => d.score));
    const worst = Math.min(...data.map(d => d.score));

    const currentScoreEl = document.getElementById('currentScore');
    const scoreChangeEl = document.getElementById('scoreChange');
    const bestScoreEl = document.getElementById('bestScore');
    const worstScoreEl = document.getElementById('worstScore');

    if (currentScoreEl) currentScoreEl.textContent = current.toFixed(1);
    if (scoreChangeEl) {
      scoreChangeEl.textContent = (change >= 0 ? '+' : '') + change + '%';
      scoreChangeEl.className = 'score-stat-value ' + (change >= 0 ? 'trend-up' : 'trend-down');
    }
    if (bestScoreEl) bestScoreEl.textContent = best.toFixed(1);
    if (worstScoreEl) worstScoreEl.textContent = worst.toFixed(1);

    // Tooltip on hover
    if (scoreCanvas) {
      scoreCanvas.onmousemove = (e) => {
        const rect2 = scoreCanvas.getBoundingClientRect();
        const mx = e.clientX - rect2.left;
        const idx = Math.round(((mx - pad.left) / chartW) * (data.length - 1));
        if (idx >= 0 && idx < data.length && chartTooltip) {
          chartTooltip.style.display = 'block';
          chartTooltip.style.left = (mx + 10) + 'px';
          const y = pad.top + chartH - ((data[idx].score - minScore) / range) * chartH;
          chartTooltip.style.top = (y - 40) + 'px';
          if (tooltipDate) tooltipDate.textContent = data[idx].date;
          if (tooltipScore) tooltipScore.textContent = data[idx].score.toFixed(1);
        }
      };
      scoreCanvas.onmouseleave = () => { if (chartTooltip) chartTooltip.style.display = 'none'; };
    }
  }

  scoreData = generateScoreData(90);
  function updateChart(range) {
    currentRange = range;
    const sliced = scoreData.slice(-range);
    drawChart(sliced);
  }

  document.querySelectorAll('.time-range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.time-range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateChart(parseInt(btn.dataset.range));
    });
  });

  // Draw chart when section is visible
  const scoreSection = document.getElementById('scoretimeline');
  if (scoreSection && scoreCanvas) {
    const chartObs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { updateChart(currentRange); chartObs.unobserve(scoreSection); }
    }, { threshold: 0.2 });
    chartObs.observe(scoreSection);
    window.addEventListener('resize', () => updateChart(currentRange));
  }

  /* ----------------------------------------------------------
     F5. AI REMEDIATION CHAT
  ---------------------------------------------------------- */
  const chatFab = document.getElementById('chatFab');
  const chatPanel = document.getElementById('chatPanel');
  const chatMinimize = document.getElementById('chatMinimize');
  const chatInput = document.getElementById('chatInput');
  const chatSendBtn = document.getElementById('chatSendBtn');
  const chatMessages = document.getElementById('chatMessages');

  function addChatMessage(content, isUser = false) {
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.className = `chat-message ${isUser ? 'user' : 'bot'}`;
    
    // Parse markdown if it's from the bot
    const formattedContent = isUser ? content : (typeof marked !== 'undefined' ? marked.parse(content) : content.replace(/\n/g, '<br>'));
    
    div.innerHTML = `
      <div class="chat-avatar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${isUser ? '<circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>' : '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'}
        </svg>
      </div>
      <div class="chat-bubble">${formattedContent}</div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function showTyping() {
    if (!chatMessages) return;
    const div = document.createElement('div');
    div.className = 'chat-message bot';
    div.id = 'typingMsg';
    div.innerHTML = `
      <div class="chat-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></div>
      <div class="chat-bubble"><div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>
    `;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function sendChatMessage() {
    if (!chatInput) return;
    const text = chatInput.value.trim();
    if (!text) return;
    
    addChatMessage(text, true);
    chatInput.value = '';
    showTyping();
    
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      
      const data = await response.json();
      const typing = document.getElementById('typingMsg');
      if (typing) typing.remove();
      
      if (data.reply) {
        addChatMessage(data.reply);
      } else {
        addChatMessage("Sorry, I encountered an error. Please try again.");
      }
    } catch (err) {
      const typing = document.getElementById('typingMsg');
      if (typing) typing.remove();
      addChatMessage("Connection error. Could not reach ShieldAI API.");
    }
  }

  if (chatFab) chatFab.addEventListener('click', () => chatPanel && chatPanel.classList.toggle('active'));
  if (chatMinimize) chatMinimize.addEventListener('click', () => chatPanel && chatPanel.classList.remove('active'));
  if (chatSendBtn) chatSendBtn.addEventListener('click', sendChatMessage);
  if (chatInput) chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChatMessage(); });
  
  const chatClearBtn = document.getElementById('chatClear');
  if (chatClearBtn) {
    chatClearBtn.addEventListener('click', () => {
      if (!chatMessages) return;
      chatMessages.innerHTML = `
        <div class="chat-message bot">
            <div class="chat-avatar">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            </div>
            <div class="chat-bubble">Conversation cleared. How can I assist you today?</div>
        </div>
      `;
    });
  }

  document.querySelectorAll('.chat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (chatInput) { chatInput.value = chip.dataset.message; sendChatMessage(); }
      if (chatPanel) chatPanel.classList.add('active');
    });
  });

  /* ----------------------------------------------------------
     F6. VULNERABILITY SCANNER SIMULATION
  ---------------------------------------------------------- */
  const startScanBtn = document.getElementById('startScanBtn');
  const scanIpInput = document.getElementById('scanIpInput');
  const scanProgress = document.getElementById('scanProgress');
  const scanProgressText = document.getElementById('scanProgressText');
  const scanProgressPercent = document.getElementById('scanProgressPercent');
  const scanOverallBar = document.getElementById('scanOverallBar');
  const scanResults = document.getElementById('scanResults');
  const exportScanBtn = document.getElementById('exportScanBtn');

  const commonPorts = [21,22,23,25,53,80,110,143,443,445,993,995,3306,3389,5432,8080,8443,27017];
  const portNames = {21:'FTP',22:'SSH',23:'Telnet',25:'SMTP',53:'DNS',80:'HTTP',110:'POP3',143:'IMAP',443:'HTTPS',445:'SMB',993:'IMAPS',995:'POP3S',3306:'MySQL',3389:'RDP',5432:'PostgreSQL',8080:'HTTP-Alt',8443:'HTTPS-Alt',27017:'MongoDB'};
  const criticalPorts = [3306,3389,27017,445];
  const highPorts = [22,23,21];
  const medPorts = [8080,8443,25];

  function getPortRisk(port) {
    if (criticalPorts.includes(port)) return 'critical';
    if (highPorts.includes(port)) return 'high';
    if (medPorts.includes(port)) return 'medium';
    return 'low';
  }

  let scanResultsData = [];

  if (startScanBtn) {
    startScanBtn.addEventListener('click', async () => {
      let ipsText = scanIpInput ? scanIpInput.value.trim() : '';
      if (!ipsText) ipsText = '192.168.1.1, 10.0.0.5, 172.16.0.1';
      const ips = ipsText.split(/[,\n]+/).map(ip => ip.trim()).filter(ip => ip);

      startScanBtn.classList.add('scanning');
      startScanBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Scanning...';

      if (scanProgress) scanProgress.style.display = 'block';
      if (scanResults) scanResults.innerHTML = '';
      if (exportScanBtn) exportScanBtn.style.display = 'none';
      scanResultsData = [];

      const totalPorts = ips.length * commonPorts.length;
      let scanned = 0;

      for (const ip of ips) {
        const ipResults = { ip, ports: [] };
        for (const port of commonPorts) {
          await new Promise(r => setTimeout(r, 80 + Math.random() * 200));
          const rand = Math.random();
          const status = rand < 0.12 ? 'open' : rand < 0.88 ? 'closed' : 'filtered';
          ipResults.ports.push({ port, service: portNames[port], status, risk: status === 'open' ? getPortRisk(port) : null });
          scanned++;
          const pct = Math.round((scanned / totalPorts) * 100);
          if (scanOverallBar) scanOverallBar.style.width = pct + '%';
          if (scanProgressPercent) scanProgressPercent.textContent = pct + '%';
          if (scanProgressText) scanProgressText.textContent = `Scanning ${ip} — Port ${port} (${portNames[port]})`;
        }
        scanResultsData.push(ipResults);
      }

      // Render results
      if (scanResults) {
        scanResults.innerHTML = scanResultsData.map(r => {
          const openPorts = r.ports.filter(p => p.status === 'open');
          const hasIssues = openPorts.length > 0;
          return `
            <div class="scan-result-card">
              <h4>${r.ip} <span class="ip-status ${hasIssues ? 'has-issues' : 'clean'}">${hasIssues ? openPorts.length + ' open' : 'Clean'}</span></h4>
              <div class="port-list">
                ${r.ports.filter(p => p.status !== 'closed').map(p => `
                  <div class="port-item ${p.status}">
                    ${p.port}/${p.service}
                    ${p.risk ? `<span class="port-risk ${p.risk}">${p.risk}</span>` : ''}
                  </div>
                `).join('')}
                ${r.ports.filter(p => p.status !== 'closed').length === 0 ? '<span style="color:var(--text-muted);font-size:0.8rem;">All ports closed ✓</span>' : ''}
              </div>
            </div>
          `;
        }).join('');
      }

      if (scanProgressText) scanProgressText.textContent = 'Scan complete!';
      startScanBtn.classList.remove('scanning');
      startScanBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Start Scan';
      if (exportScanBtn) exportScanBtn.style.display = 'flex';
      if (typeof showToast === 'function') showToast('Scan complete! ' + scanResultsData.reduce((a, r) => a + r.ports.filter(p => p.status === 'open').length, 0) + ' open ports found.');
    });
  }

  if (exportScanBtn) {
    exportScanBtn.addEventListener('click', () => {
      let csv = 'IP,Port,Service,Status,Risk\n';
      scanResultsData.forEach(r => {
        r.ports.forEach(p => {
          csv += `${r.ip},${p.port},${p.service},${p.status},${p.risk || 'N/A'}\n`;
        });
      });
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `shieldai-scan-${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      if (typeof showToast === 'function') showToast('Scan results exported as CSV!');
    });
  }

  /* ----------------------------------------------------------
     F7. AUDIT LOG TIMELINE
  ---------------------------------------------------------- */
  const auditTimeline = document.getElementById('auditTimeline');
  const loadMoreAudit = document.getElementById('loadMoreAudit');

  const auditTemplates = [
    { type: 'scan', title: 'Full Infrastructure Scan', desc: 'Scanned 2,847 resources across 3 cloud providers. 12 issues detected.', resource: 'All Regions', user: 'ShieldAI Bot' },
    { type: 'scan', title: 'IAM Policy Audit', desc: 'Reviewed 342 IAM policies. 5 overly permissive roles identified.', resource: 'IAM', user: 'ShieldAI Bot' },
    { type: 'fix', title: 'S3 Bucket Logging Enabled', desc: 'Auto-remediation: Enabled access logging for 4 S3 buckets.', resource: 's3://client-data', user: 'Auto-Fix' },
    { type: 'fix', title: 'Security Group Restricted', desc: 'Removed 0.0.0.0/0 inbound rule on port 22 for sg-0a1b2c3d.', resource: 'sg-0a1b2c3d', user: 'Admin' },
    { type: 'alert', title: 'Critical: Public Database', desc: 'RDS instance prod-db-01 has public accessibility enabled.', resource: 'prod-db-01', user: 'ShieldAI Bot' },
    { type: 'alert', title: 'Brute Force Attempt Detected', desc: '47 failed SSH login attempts from 203.0.113.42 in 5 minutes.', resource: 'bastion-host', user: 'IDS' },
    { type: 'policy', title: 'CIS Benchmark Updated', desc: 'CIS AWS Foundations v1.5 policy rules updated and applied.', resource: 'Policy Engine', user: 'Admin' },
    { type: 'policy', title: 'New Geo-Block Rule Added', desc: 'Traffic from North Korea (KP) blocked at all ingress points.', resource: 'WAF', user: 'Admin' },
    { type: 'fix', title: 'SSL Certificate Renewed', desc: 'Auto-renewed certificate for *.example.com (expires 2027-01-15).', resource: 'ACM', user: 'Auto-Fix' },
    { type: 'scan', title: 'Compliance Gap Analysis', desc: 'Generated SOC 2 compliance report. Score: 94.2% (up from 89.1%).', resource: 'Compliance Engine', user: 'ShieldAI Bot' },
  ];

  let auditEntries = [];
  let auditFilterType = 'all';

  function generateAuditEntry() {
    const tmpl = auditTemplates[Math.floor(Math.random() * auditTemplates.length)];
    const hoursAgo = Math.floor(Math.random() * 168);
    const time = new Date(Date.now() - hoursAgo * 3600000);
    return {
      ...tmpl,
      time: time,
      timeStr: hoursAgo < 1 ? 'Just now' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo/24)}d ago`,
      result: Math.random() > 0.15 ? 'success' : 'warning'
    };
  }

  for (let i = 0; i < 12; i++) auditEntries.push(generateAuditEntry());
  auditEntries.sort((a, b) => b.time - a.time);

  function renderAuditTimeline(filter) {
    if (!auditTimeline) return;
    const line = auditTimeline.querySelector('.audit-timeline-line');
    auditTimeline.innerHTML = '';
    if (line) auditTimeline.appendChild(line);
    else {
      const newLine = document.createElement('div');
      newLine.className = 'audit-timeline-line';
      auditTimeline.appendChild(newLine);
    }

    const filtered = filter === 'all' ? auditEntries : auditEntries.filter(e => e.type === filter);
    filtered.forEach((entry, idx) => {
      const div = document.createElement('div');
      div.className = 'audit-item';
      div.style.animationDelay = (idx * 0.05) + 's';
      div.innerHTML = `
        <div class="audit-dot ${entry.type}"></div>
        <div class="audit-card" data-idx="${idx}">
          <div class="audit-card-header">
            <span class="audit-card-type ${entry.type}">${entry.type}</span>
            <span class="audit-card-time">${entry.timeStr}</span>
          </div>
          <div class="audit-card-title">${entry.title}</div>
          <div class="audit-card-details">
            <p>${entry.desc}</p>
            <div class="audit-detail-row"><span>Resource:</span> <span>${entry.resource}</span></div>
            <div class="audit-detail-row"><span>Initiated by:</span> <span>${entry.user}</span></div>
          </div>
        </div>
      `;
      auditTimeline.appendChild(div);
    });

    auditTimeline.querySelectorAll('.audit-card').forEach(card => {
      card.addEventListener('click', () => card.classList.toggle('expanded'));
    });
  }

  renderAuditTimeline('all');

  document.querySelectorAll('[data-audit-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-audit-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      auditFilterType = btn.dataset.auditFilter;
      renderAuditTimeline(auditFilterType);
    });
  });

  if (loadMoreAudit) {
    loadMoreAudit.addEventListener('click', () => {
      for (let i = 0; i < 6; i++) auditEntries.push(generateAuditEntry());
      auditEntries.sort((a, b) => b.time - a.time);
      renderAuditTimeline(auditFilterType);
      if (typeof showToast === 'function') showToast('Loaded 6 more audit events');
    });
  }

  /* ----------------------------------------------------------
     F8. PDF REPORT GENERATOR (jsPDF)
  ---------------------------------------------------------- */
  const pdfOverlay = document.getElementById('pdfOverlay');
  const pdfProgressFill = document.getElementById('pdfProgressFill');
  const pdfProgressTextEl = document.getElementById('pdfProgressText');

  if (downloadReportBtn) {
    downloadReportBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      if (typeof window.jspdf === 'undefined' || typeof html2canvas === 'undefined') {
        if (typeof showToast === 'function') showToast('PDF library loading... Please try again in a moment.');
        return;
      }

      if (pdfOverlay) pdfOverlay.style.display = 'flex';

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF('p', 'mm', 'a4');
      const w = doc.internal.pageSize.getWidth();
      const h = doc.internal.pageSize.getHeight();
      
      const savedConfig = JSON.parse(localStorage.getItem('shieldai_config') || '{}');
      const company = savedConfig.companyName || 'Your Organization';
      const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

      // Page 1 — Cover
      if (pdfProgressTextEl) pdfProgressTextEl.textContent = 'Creating cover page...';
      if (pdfProgressFill) pdfProgressFill.style.width = '10%';
      await new Promise(r => setTimeout(r, 200));

      doc.setFillColor(10, 14, 23);
      doc.rect(0, 0, w, h, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(28);
      doc.text('Security Compliance', w/2, 100, { align: 'center' });
      doc.text('Report', w/2, 115, { align: 'center' });
      doc.setFontSize(14);
      doc.setTextColor(76, 201, 240);
      doc.text(company, w/2, 140, { align: 'center' });
      doc.setTextColor(160, 160, 160);
      doc.setFontSize(11);
      doc.text(today, w/2, 155, { align: 'center' });
      doc.text('Generated by ShieldAI Security Bot', w/2, 170, { align: 'center' });

      // Helper function to capture and add section to PDF
      const addSectionToPdf = async (sectionId, progressText, progressPct) => {
        if (pdfProgressTextEl) pdfProgressTextEl.textContent = progressText;
        if (pdfProgressFill) pdfProgressFill.style.width = progressPct + '%';
        
        const section = document.getElementById(sectionId);
        if (section) {
          try {
            const canvas = await html2canvas(section, {
              scale: 2,
              backgroundColor: '#0a0e17',
              logging: false,
              useCORS: true
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            const imgProps = doc.getImageProperties(imgData);
            const pdfWidth = doc.internal.pageSize.getWidth();
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            doc.addPage();
            doc.setFillColor(10, 14, 23);
            doc.rect(0, 0, w, h, 'F');
            doc.addImage(imgData, 'JPEG', 0, 10, pdfWidth, pdfHeight);
          } catch(e) {
            console.error('Error capturing section', sectionId, e);
          }
        }
      };

      await addSectionToPdf('dashboard', 'Capturing Live Dashboard...', 30);
      await addSectionToPdf('scoretimeline', 'Capturing Score Analytics...', 60);
      await addSectionToPdf('compliance', 'Capturing Compliance Metrics...', 90);

      if (pdfProgressTextEl) pdfProgressTextEl.textContent = 'Finalizing PDF...';
      if (pdfProgressFill) pdfProgressFill.style.width = '100%';
      await new Promise(r => setTimeout(r, 400));

      doc.save(`${company.replace(/\s+/g, '-')}-security-report-${new Date().toISOString().slice(0,10)}.pdf`);
      
      if (pdfOverlay) pdfOverlay.style.display = 'none';
      if (pdfProgressFill) pdfProgressFill.style.width = '0%';
      if (typeof showToast === 'function') showToast('PDF Report downloaded successfully! 📄');
    });
  }

  /* ----------------------------------------------------------
     F9. ZERO TRUST POLICY BUILDER (Drag & Drop)
  ---------------------------------------------------------- */
  const policyDropZone = document.getElementById('policyDropZone');
  const dropPlaceholder = document.getElementById('dropPlaceholder');
  const validatePolicyBtn = document.getElementById('validatePolicyBtn');
  const exportPolicyBtn = document.getElementById('exportPolicyBtn');
  const applyPolicyBtn = document.getElementById('applyPolicyBtn');
  const policyValidation = document.getElementById('policyValidation');
  let policyRules = [];
  let policyIdCounter = 0;

  // Palette drag events
  document.querySelectorAll('.rule-palette-card').forEach(card => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', card.dataset.ruleType);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  // Drop zone events
  if (policyDropZone) {
    policyDropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      policyDropZone.classList.add('drag-over');
    });
    policyDropZone.addEventListener('dragleave', () => policyDropZone.classList.remove('drag-over'));
    policyDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      policyDropZone.classList.remove('drag-over');
      const ruleType = e.dataTransfer.getData('text/plain');
      if (ruleType) addPolicyRule(ruleType);
    });
  }

  function getFieldsForType(type) {
    switch(type) {
      case 'allow': case 'deny':
        return `<input type="text" placeholder="Source CIDR" class="rule-source"><input type="text" placeholder="Destination" class="rule-dest"><input type="text" placeholder="Port" class="rule-port"><select class="rule-protocol"><option>TCP</option><option>UDP</option><option>ICMP</option><option>Any</option></select>`;
      case 'conditional':
        return `<input type="text" placeholder="Source CIDR" class="rule-source"><input type="text" placeholder="Port" class="rule-port"><select class="rule-condition"><option>MFA Required</option><option>Time-Based (Business Hours)</option><option>IP Whitelist</option><option>Device Trust</option></select>`;
      case 'ratelimit':
        return `<input type="text" placeholder="Endpoint" class="rule-endpoint"><input type="number" placeholder="Req/min" class="rule-rate" value="100"><input type="number" placeholder="Burst" class="rule-burst" value="200">`;
      case 'geoblock':
        return `<select class="rule-countries" multiple size="3"><option value="KP">North Korea</option><option value="RU">Russia</option><option value="CN">China</option><option value="IR">Iran</option><option value="SY">Syria</option><option value="CU">Cuba</option></select><select class="rule-geo-action"><option>Block</option><option>Allow Only</option></select>`;
      default: return '';
    }
  }

  function addPolicyRule(type, prefill = {}) {
    if (dropPlaceholder) dropPlaceholder.style.display = 'none';
    const id = ++policyIdCounter;
    policyRules.push({ id, type, ...prefill });

    // Add arrow between rules
    if (policyDropZone.querySelectorAll('.policy-rule').length > 0) {
      const arrow = document.createElement('div');
      arrow.className = 'policy-rule-arrow';
      arrow.innerHTML = '↓';
      policyDropZone.appendChild(arrow);
    }

    const ruleEl = document.createElement('div');
    ruleEl.className = 'policy-rule';
    ruleEl.dataset.ruleId = id;
    ruleEl.innerHTML = `
      <span class="policy-rule-type ${type}">${type === 'ratelimit' ? 'Rate Limit' : type === 'geoblock' ? 'Geo-Block' : type}</span>
      <div class="policy-rule-fields">${getFieldsForType(type)}</div>
      <div class="policy-rule-actions">
        <button class="rule-delete" title="Delete">✕</button>
        <button class="rule-move-up" title="Move up">↑</button>
        <button class="rule-move-down" title="Move down">↓</button>
      </div>
    `;

    // Prefill values
    if (prefill.source) { const el = ruleEl.querySelector('.rule-source'); if (el) el.value = prefill.source; }
    if (prefill.dest) { const el = ruleEl.querySelector('.rule-dest'); if (el) el.value = prefill.dest; }
    if (prefill.port) { const el = ruleEl.querySelector('.rule-port'); if (el) el.value = prefill.port; }

    ruleEl.querySelector('.rule-delete').addEventListener('click', () => {
      policyRules = policyRules.filter(r => r.id !== id);
      const prev = ruleEl.previousElementSibling;
      if (prev && prev.classList.contains('policy-rule-arrow')) prev.remove();
      else { const next = ruleEl.nextElementSibling; if (next && next.classList.contains('policy-rule-arrow')) next.remove(); }
      ruleEl.remove();
      if (policyDropZone.querySelectorAll('.policy-rule').length === 0 && dropPlaceholder) dropPlaceholder.style.display = 'flex';
    });

    policyDropZone.appendChild(ruleEl);
  }

  // Template loading
  const templates = {
    cis: [
      { type: 'deny', source: '0.0.0.0/0', dest: '*', port: '22' },
      { type: 'deny', source: '0.0.0.0/0', dest: '*', port: '3389' },
      { type: 'conditional', source: '10.0.0.0/8', port: '443' },
      { type: 'allow', source: '10.0.0.0/8', dest: '10.0.0.0/8', port: '*' },
      { type: 'ratelimit' },
      { type: 'geoblock' },
    ],
    soc2: [
      { type: 'conditional', source: '*', port: '*' },
      { type: 'deny', source: '0.0.0.0/0', dest: '*', port: '21,23,445' },
      { type: 'allow', source: '10.0.0.0/8', dest: 'prod-vpc', port: '443' },
      { type: 'ratelimit' },
    ],
    hipaa: [
      { type: 'deny', source: '0.0.0.0/0', dest: 'phi-subnet', port: '*' },
      { type: 'conditional', source: 'admin-vpc', port: '443' },
      { type: 'allow', source: 'vpn-cidr', dest: 'phi-subnet', port: '443' },
      { type: 'geoblock' },
      { type: 'ratelimit' },
    ],
    pci: [
      { type: 'deny', source: '0.0.0.0/0', dest: 'cardholder-env', port: '*' },
      { type: 'allow', source: 'pci-vlan', dest: 'cardholder-env', port: '443' },
      { type: 'conditional', source: '*', port: '3306' },
      { type: 'ratelimit' },
    ]
  };

  document.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Clear existing
      policyRules = [];
      policyIdCounter = 0;
      if (policyDropZone) {
        policyDropZone.innerHTML = '';
        if (dropPlaceholder) policyDropZone.appendChild(dropPlaceholder);
      }
      const tmpl = templates[btn.dataset.template];
      if (tmpl) tmpl.forEach(r => addPolicyRule(r.type, r));
      if (typeof showToast === 'function') showToast(`${btn.textContent.trim()} template loaded!`);
    });
  });

  if (validatePolicyBtn) {
    validatePolicyBtn.addEventListener('click', () => {
      if (policyRules.length === 0) {
        if (policyValidation) { policyValidation.style.display = 'block'; policyValidation.className = 'policy-validation error'; policyValidation.textContent = '✕ No rules defined. Add at least one rule to validate.'; }
        return;
      }
      // Check if all fields have values
      const emptyFields = policyDropZone.querySelectorAll('input:placeholder-shown');
      if (emptyFields.length > 0) {
        if (policyValidation) { policyValidation.style.display = 'block'; policyValidation.className = 'policy-validation error'; policyValidation.textContent = `✕ Validation failed: ${emptyFields.length} field(s) still empty.`; }
      } else {
        if (policyValidation) { policyValidation.style.display = 'block'; policyValidation.className = 'policy-validation success'; policyValidation.textContent = `✓ Policy validated! ${policyRules.length} rules are correctly configured.`; }
      }
      setTimeout(() => { if (policyValidation) policyValidation.style.display = 'none'; }, 4000);
    });
  }

  if (exportPolicyBtn) {
    exportPolicyBtn.addEventListener('click', () => {
      const rules = [];
      policyDropZone.querySelectorAll('.policy-rule').forEach(ruleEl => {
        const type = ruleEl.querySelector('.policy-rule-type').textContent.trim().toLowerCase();
        const rule = { type, priority: rules.length + 1 };
        ruleEl.querySelectorAll('input, select').forEach(field => {
          const cls = [...field.classList].find(c => c.startsWith('rule-'));
          if (cls) rule[cls.replace('rule-', '')] = field.value;
        });
        rules.push(rule);
      });
      const blob = new Blob([JSON.stringify({ policyName: 'ShieldAI Zero Trust Policy', version: '1.0', generatedAt: new Date().toISOString(), rules }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `shieldai-policy-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      if (typeof showToast === 'function') showToast('Policy exported as JSON!');
    });
  }

  if (applyPolicyBtn) {
    applyPolicyBtn.addEventListener('click', () => {
      if (policyRules.length === 0) {
        if (typeof showToast === 'function') showToast('No rules to apply. Add rules first.');
        return;
      }
      localStorage.setItem('shieldai_policies', JSON.stringify(policyRules));
      if (typeof showToast === 'function') showToast(`✓ ${policyRules.length} policy rules applied successfully!`);
    });
  }

  /* ----------------------------------------------------------
     F10. INTERACTIVE CLOUD TOPOLOGY MAP
  ---------------------------------------------------------- */
  const canvas = document.getElementById('topologyCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    const tooltip = document.getElementById('topologyTooltip');
    const container = document.getElementById('topologyContainer');
    let width, height;

    function resize() {
      width = container.clientWidth;
      height = container.clientHeight;
      canvas.width = width;
      canvas.height = height;
    }
    window.addEventListener('resize', resize);
    resize();

    const nodes = [
      { id: 'lb', label: 'Load Balancer', type: 'aws', x: width/2, y: 100, radius: 25, vulnerable: false },
      { id: 'web1', label: 'Web Server 1', type: 'aws', x: width/2 - 100, y: 200, radius: 20, vulnerable: false },
      { id: 'web2', label: 'Web Server 2', type: 'aws', x: width/2 + 100, y: 200, radius: 20, vulnerable: false },
      { id: 'db1', label: 'Primary DB', type: 'azure', x: width/2 - 150, y: 350, radius: 25, vulnerable: true }, // Vulnerable
      { id: 'db2', label: 'Replica DB', type: 'azure', x: width/2 + 150, y: 350, radius: 25, vulnerable: false },
      { id: 's3', label: 'Static Assets', type: 'aws', x: width/2 + 250, y: 150, radius: 30, vulnerable: true }, // Vulnerable
      { id: 'gke', label: 'GKE Cluster', type: 'gcp', x: width/2 - 250, y: 150, radius: 30, vulnerable: false }
    ];

    const links = [
      { source: 'lb', target: 'web1' },
      { source: 'lb', target: 'web2' },
      { source: 'web1', target: 'db1' },
      { source: 'web2', target: 'db1' },
      { source: 'db1', target: 'db2' },
      { source: 'lb', target: 's3' },
      { source: 'lb', target: 'gke' }
    ];

    const colors = {
      'aws': '#ff9900',
      'azure': '#0089d6',
      'gcp': '#ea4335'
    };

    let draggedNode = null;
    let hoveredNode = null;
    let pulseAngle = 0;

    function draw() {
      ctx.clearRect(0, 0, width, height);
      pulseAngle += 0.05;

      // Draw Links
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      links.forEach(link => {
        const source = nodes.find(n => n.id === link.source);
        const target = nodes.find(n => n.id === link.target);
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          ctx.lineTo(target.x, target.y);
          ctx.stroke();
          
          // Draw moving particle on link
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const dist = Math.sqrt(dx*dx + dy*dy);
          const pOffset = (performance.now() / 20 % dist) / dist;
          ctx.beginPath();
          ctx.arc(source.x + dx * pOffset, source.y + dy * pOffset, 3, 0, Math.PI*2);
          ctx.fillStyle = source.vulnerable || target.vulnerable ? '#ff1744' : '#4cc9f0';
          ctx.fill();
        }
      });

      // Draw Nodes
      nodes.forEach(node => {
        if (node.vulnerable) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 10 + Math.sin(pulseAngle) * 5, 0, Math.PI*2);
          ctx.fillStyle = 'rgba(255, 23, 68, 0.2)';
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI*2);
        ctx.fillStyle = node === hoveredNode ? '#ffffff' : colors[node.type];
        ctx.fill();
        
        if (node.vulnerable) {
          ctx.strokeStyle = '#ff1744';
          ctx.lineWidth = 3;
          ctx.stroke();
        }

        ctx.fillStyle = '#fff';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x, node.y + node.radius + 20);
      });

      requestAnimationFrame(draw);
    }

    // Mouse interaction
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (draggedNode) {
        draggedNode.x = x;
        draggedNode.y = y;
        return;
      }

      hoveredNode = nodes.find(n => {
        const dx = n.x - x;
        const dy = n.y - y;
        return Math.sqrt(dx*dx + dy*dy) < n.radius;
      });

      if (hoveredNode) {
        canvas.style.cursor = 'pointer';
        tooltip.style.display = 'block';
        tooltip.style.left = e.clientX + 15 + 'px';
        tooltip.style.top = e.clientY + 15 + 'px';
        tooltip.innerHTML = `<span class="t-title">${hoveredNode.label}</span>
                             <span class="t-type">Provider: ${hoveredNode.type.toUpperCase()}</span>
                             <div style="color: ${hoveredNode.vulnerable ? '#ff1744' : '#00e676'}; margin-top: 5px; font-size: 0.8rem;">
                               Status: ${hoveredNode.vulnerable ? 'CRITICAL RISK' : 'SECURE'}
                             </div>`;
      } else {
        canvas.style.cursor = 'grab';
        tooltip.style.display = 'none';
      }
    });

    canvas.addEventListener('mousedown', () => {
      if (hoveredNode) draggedNode = hoveredNode;
    });

    canvas.addEventListener('mouseup', () => {
      draggedNode = null;
    });

    canvas.addEventListener('mouseleave', () => {
      draggedNode = null;
      tooltip.style.display = 'none';
    });
    
    document.getElementById('topologyResetBtn')?.addEventListener('click', () => {
      // Reset positions to original
      nodes[0].x = width/2; nodes[0].y = 100;
      nodes[1].x = width/2 - 100; nodes[1].y = 200;
      nodes[2].x = width/2 + 100; nodes[2].y = 200;
      nodes[3].x = width/2 - 150; nodes[3].y = 350;
      nodes[4].x = width/2 + 150; nodes[4].y = 350;
      nodes[5].x = width/2 + 250; nodes[5].y = 150;
      nodes[6].x = width/2 - 250; nodes[6].y = 150;
    });

    draw();
  }

}); // end DOMContentLoaded
