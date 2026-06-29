/* ============================================================
   Security Posture Auto-Hardening Bot — script.js
   Complete interactive logic: scroll animations, real-time
   scanning simulation, live detection feed, charts, filters,
   one-click fixes, activity ticker, toasts, and more.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

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
    const container = circle.closest('.donut-chart') || circle.closest('.donut-container') || circle.parentElement.parentElement;
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

}); // end DOMContentLoaded
