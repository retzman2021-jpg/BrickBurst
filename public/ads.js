// AdMob Rewarded Ads — works on Android/iOS via Capacitor
// Falls back to fake "test ad" in browser for development

const AD = {
  // 🔴 REPLACE THESE WITH YOUR REAL ADMOB IDs BEFORE PUBLISHING
  // Use THESE TEST IDs during development (Google's official test units)
  testAdUnitAndroid: 'ca-app-pub-6054937913090648/5231562791',
  testAdUnitIOS: 'ca-app-pub-3940256099942544/1712485313',

  async init() {
    try {
      const { AdMob } = await import('@capacitor-community/admob');
      await AdMob.initialize();
      this._admob = AdMob;
      this._native = true;
      console.log('✅ AdMob native ready');
    } catch {
      this._native = false;
      console.log('ℹ️ Running in browser — using test ad fallback');
    }
  },

  // Show rewarded ad → returns { earned: true/false, points: 200 }
  async showRewarded() {
    if (this._native) return this._showNative();
    return this._showWebFallback();
  },

  async _showNative() {
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const adId = isIOS ? this.testAdUnitIOS : this.testAdUnitAndroid;

      await this._admob.prepareRewardVideoAd({
        adId,
        isTesting: true, // 🔴 SET TO FALSE IN PRODUCTION
        ssv: { userId: localStorage.getItem('user_id') || 'anon' }
      });

      const reward = await this._admob.showRewardVideoAd();
      // reward.type = 'coins', reward.amount = number from AdMob dashboard
      return { earned: true, points: 200, source: 'admob' };
    } catch (e) {
      console.warn('Ad failed:', e);
      return { earned: false, error: e.message };
    }
  },

  // Browser-only: simulates ad for testing without Capacitor
  _showWebFallback() {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:#000;z-index:99999;display:flex;align-items:center;justify-content:center;flex-direction:column;color:#fff;font-family:system-ui';
      overlay.innerHTML = `
        <div style="background:#1e293b;padding:30px;border-radius:16px;text-align:center;max-width:320px">
          <div style="font-size:12px;color:#94a3b8;margin-bottom:8px">📺 TEST AD — Browser Mode</div>
          <div style="font-size:18px;font-weight:700;margin-bottom:16px">Watch video to earn +200 pts</div>
          <div id="adCount" style="font-size:32px;font-weight:800;color:#fbbf24;margin:20px 0">0:05</div>
          <button id="adClose" disabled style="padding:10px 24px;border-radius:8px;border:none;background:#64748b;color:#fff;cursor:not-allowed">Close</button>
        </div>`;
      document.body.appendChild(overlay);

      let sec = 5;
      const timer = setInterval(() => {
        sec--;
        overlay.querySelector('#adCount').textContent = '0:0' + sec;
        if (sec <= 0) {
          clearInterval(timer);
          const btn = overlay.querySelector('#adClose');
          btn.disabled = false;
          btn.style.background = '#2563eb';
          btn.style.cursor = 'pointer';
          btn.textContent = '✅ Claim +200 Points';
          btn.onclick = () => {
            document.body.removeChild(overlay);
            resolve({ earned: true, points: 200, source: 'test' });
          };
        }
      }, 1000);
    });
  }
};

// Auto-init
AD.init();