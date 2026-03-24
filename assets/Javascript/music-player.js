// Persist and resume background music across page navigations
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        try {
            var audio = document.getElementById('background-music');
            if (!audio) {
                audio = document.createElement('audio');
                audio.id = 'background-music';
                audio.loop = true;
                // preload to reduce startup lag
                audio.preload = 'auto';
                var path = (window.location.pathname.indexOf('/pages/') !== -1) ? '../assets/music/music.mp3' : './assets/music/music.mp3';
                audio.src = path;
                audio.style.display = 'none';
                document.body.appendChild(audio);
                // start loading immediately
                try { audio.load(); } catch (e) { }
            } else {
                // make sure existing audio is preloading to reduce delay
                try {
                    if (!audio.preload || audio.preload === 'none') audio.preload = 'auto';
                    audio.load();
                } catch (e) { }
            }

            var KEY_PLAYING = 'bgMusic_playing';
            var KEY_TIME = 'bgMusic_time';

            // Restore saved time & playing state
            var wasPlaying = localStorage.getItem(KEY_PLAYING) === 'true';
            var savedTime = parseFloat(localStorage.getItem(KEY_TIME) || '0');

            function trySetTime() {
                if (!isNaN(savedTime) && savedTime > 0 && audio.duration && !isNaN(audio.duration)) {
                    audio.currentTime = Math.min(savedTime, audio.duration - 0.1);
                }
            }

            if (audio.readyState >= 1) trySetTime();
            else audio.addEventListener('loadedmetadata', trySetTime);

            function safePlay() {
                try {
                    if (audio.readyState >= 4) return audio.play();
                    // wait for enough data
                    audio.addEventListener('canplaythrough', function onReady() {
                        audio.removeEventListener('canplaythrough', onReady);
                        audio.play().catch(function () { });
                    }, { once: true });
                } catch (e) { }
            }

            if (wasPlaying) {
                safePlay();
            }

            // If music wasn't already playing, start playback on first user interaction
            // (works around browser autoplay policies which require a user gesture)
            if (!wasPlaying) {
                function startOnInteraction() {
                    safePlay();
                    try { localStorage.setItem(KEY_PLAYING, 'true'); } catch (e) { }
                    document.removeEventListener('pointerdown', startOnInteraction);
                    document.removeEventListener('keydown', startOnInteraction);
                }
                document.addEventListener('pointerdown', startOnInteraction, { once: true });
                document.addEventListener('keydown', startOnInteraction, { once: true });
            }

            // Optional UI toggle if present
            var toggleBtn = document.getElementById('music-toggle-btn');
            if (toggleBtn) {
                toggleBtn.classList.remove('hidden');
                var onIcon = document.getElementById('music-on-icon');
                var offIcon = document.getElementById('music-off-icon');
                function updateIcons() {
                    var on = !audio.paused;
                    if (onIcon) onIcon.classList.toggle('hidden', !on);
                    if (offIcon) offIcon.classList.toggle('hidden', on);
                }
                toggleBtn.addEventListener('click', function () {
                    if (audio.paused) audio.play().catch(function () { });
                    else audio.pause();
                    updateIcons();
                    try { localStorage.setItem(KEY_PLAYING, (!audio.paused).toString()); } catch (e) { }
                });
                audio.addEventListener('play', updateIcons);
                audio.addEventListener('pause', updateIcons);
                updateIcons();
            }

            // Save state
            function saveState() {
                try {
                    localStorage.setItem(KEY_PLAYING, (!audio.paused).toString());
                    localStorage.setItem(KEY_TIME, String(audio.currentTime));
                } catch (e) { }
            }

            // Keep localStorage in sync when playback changes
            audio.addEventListener('play', function () { try { localStorage.setItem(KEY_PLAYING, 'true'); } catch (e) { } });
            audio.addEventListener('pause', function () { try { localStorage.setItem(KEY_PLAYING, 'false'); } catch (e) { } });

            // If user unmutes (volume change) and music is supposed to be playing, try to resume
            audio.addEventListener('volumechange', function () {
                try {
                    var want = localStorage.getItem(KEY_PLAYING) === 'true';
                    if (!audio.muted && want && audio.paused) {
                        audio.play().catch(function () { });
                    }
                } catch (e) { }
            });

            // Try to resume on visibility change (user may have interacted elsewhere)
            document.addEventListener('visibilitychange', function () {
                try {
                    if (document.visibilityState === 'visible') {
                        var want = localStorage.getItem(KEY_PLAYING) === 'true';
                        if (want && audio.paused) audio.play().catch(function () { });
                    }
                } catch (e) { }
            });

            // Save on navigation events & periodically while playing
            ['pagehide', 'beforeunload'].forEach(function (ev) { window.addEventListener(ev, saveState); });
            document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') saveState(); });
            // Throttle time saves to once every 2s to avoid overhead and potential lag
            var _lastSavedAt = 0;
            audio.addEventListener('timeupdate', function () {
                if (!audio.paused) {
                    try {
                        var now = Date.now();
                        if (now - _lastSavedAt > 2000) {
                            localStorage.setItem(KEY_TIME, String(audio.currentTime));
                            _lastSavedAt = now;
                        }
                    } catch (e) { }
                }
            });
        } catch (err) {
            console.error('music-player error', err);
        }
    });
})();
