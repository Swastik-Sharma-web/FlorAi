document.addEventListener('DOMContentLoaded', () => {
    // 1. Navbar Scroll Effect
    const nav = document.querySelector('nav');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // 2. Smooth Scrolling for Anchor Links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const navHeight = nav.offsetHeight;
                window.scrollTo({
                    top: targetElement.offsetTop - navHeight,
                    behavior: 'smooth'
                });
            }
        });
    });

    // 3. Scroll Reveal Animations (Optional addition for luxury feel)
    const fadeElements = document.querySelectorAll('.glass-card, .workflow-item, .feature-box');
    const observerOptions = {
        threshold: 0.1,
        rootMargin: "0px 0px -50px 0px"
    };

    const fadeObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    fadeElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        fadeObserver.observe(el);
    });

    // 4. Image Upload & Mock AI Detection Logic
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const previewContainer = document.getElementById('previewContainer');
    const previewImage = document.getElementById('previewImage');
    const uploadText = document.querySelector('.upload-text');
    const uploadSubtext = document.querySelector('.upload-subtext');
    const uploadIcon = document.querySelector('.upload-icon');
    
    const loadingSpinner = document.getElementById('loadingSpinner');
    const resultPanel = document.getElementById('resultPanel');
    
    // Result elements
    const resStatusText = document.getElementById('resStatusText');
    const resDisease = document.getElementById('resDisease');
    const resConfidence = document.getElementById('resConfidence');
    const resConfidenceBar = document.getElementById('resConfidenceBar');
    const resAdvice = document.getElementById('resAdvice');

    // Handle Drag & Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, () => {
            uploadArea.classList.remove('dragover');
        }, false);
    });

    // Handle File Drop
    uploadArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }, false);

    // Handle Click to Upload
    uploadArea.addEventListener('click', () => {
        // Prevent click if currently loading
        if (loadingSpinner.style.display === 'block') return;
        fileInput.click();
    });

    fileInput.addEventListener('change', function() {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length === 0) return;
        const file = files[0];
        
        // Basic image validation
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file.');
            return;
        }

        // Display Preview
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = function() {
            previewImage.src = reader.result;
            showPreview();
            simulateAIModelPrediction(file);
        }
    }

    function showPreview() {
        uploadIcon.style.display = 'none';
        uploadText.style.display = 'none';
        uploadSubtext.style.display = 'none';
        previewContainer.style.display = 'block';
        resultPanel.style.display = 'none'; // Hide old results
    }

    // placeholder API endpoint config designed for simple replacement
    const API_ENDPOINT = '/api/predict'; 
    
    // Global variable to cache location so we only ask for permission ONCE
    let globalLat = null;
    let globalLon = null;
    let globalRegion = null;
    let leafletMap = null;

    function initMapOnce(lat, lon, regionStr) {
        if (!document.getElementById('locationMap')) return;
        
        // Use default coordinates if none provided
        lat = lat || 28.6139;
        lon = lon || 77.2090;
        
        // Initialize map only once
        if (typeof L !== 'undefined' && !leafletMap) {
            leafletMap = L.map('locationMap').setView([lat, lon], 9);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap'
            }).addTo(leafletMap);
            
            L.marker([lat, lon]).addTo(leafletMap)
                .bindPopup('<b style="color:var(--primary-green)">Detection Zone</b>')
                .openPopup();
        } else if (leafletMap) {
            leafletMap.setView([lat, lon], 9);
        }
        
        const regionEl = document.getElementById('regionText');
        if (regionEl && regionStr) {
            regionEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> Zone: ${regionStr}`;
            globalRegion = regionStr;
        }
    }

    function reverseGeocode(lat, lon) {
        // Use standard Nominatim reverse geocoding to find the state/region for soil profiling
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`)
            .then(res => res.json())
            .then(data => {
                let region = "Unknown Region";
                if (data && data.address) {
                    // Try to extract the most agriculturally relevant boundary
                    region = data.address.state || data.address.county || data.address.region || data.address.country || "Unknown Region";
                }
                initMapOnce(lat, lon, region);
            })
            .catch(err => {
                console.warn("Reverse geocoding failed", err);
                initMapOnce(lat, lon, "Region Lookup Failed");
            });
    }

    function simulateAIModelPrediction(file) {
        // Show loading state
        loadingSpinner.style.display = 'block';
        
        // Use cached coordinates if we already got permission on page load
        if (globalLat !== null && globalLon !== null) {
            sendPredictionRequest(file, globalLat, globalLon);
            return;
        }
        
        // Otherwise, fallback to asking
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    sendPredictionRequest(file, position.coords.latitude, position.coords.longitude);
                },
                (error) => {
                    console.warn("Location access denied or failed. Proceeding without GPS.", error);
                    sendPredictionRequest(file, null, null);
                },
                { timeout: 5000 } // Don't hang forever waiting for location
            );
        } else {
            console.warn("Geolocation not supported. Proceeding without GPS.");
            sendPredictionRequest(file, null, null);
        }
    }
    
    function sendPredictionRequest(file, latitude, longitude) {
        // --- REAL BACKEND CONNECTION (FastAPI) ---
        const formData = new FormData();
        formData.append('file', file);
        if (latitude !== null && longitude !== null) {
            formData.append('latitude', latitude);
            formData.append('longitude', longitude);
        }
        if (globalRegion) {
            formData.append('region', globalRegion);
        }
        
        // Pointing to local FastAPI server (now using relative path to support both local and remote)
        fetch('/api/predict', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            displayResults(data);
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Error connecting to prediction server.\n\nThe AI backend might still be loading into memory (it takes 15-30 seconds on startup), or it may have crashed.\n\nPlease check the black terminal window for errors, and try uploading again in a few seconds!');
            loadingSpinner.style.display = 'none';
        });
    }

    function displayResults(data) {
        loadingSpinner.style.display = 'none';
        resultPanel.style.display = 'block';

        // Clear any old inline styles that might persist across uploads
        resStatusText.style.background = '';
        resStatusText.style.color = '';

        // Update DOM
        if (data.health_status.toLowerCase() === 'healthy') {
            resStatusText.className = 'status-badge status-healthy';
            resStatusText.innerHTML = '<i class="fa-solid fa-check-circle"></i> Healthy';
        } else if (data.health_status.toLowerCase() === 'uncertain') {
            resStatusText.className = 'status-badge status-invalid';
            resStatusText.innerHTML = '<i class="fa-regular fa-circle-question"></i> Uncertain';
        } else if (data.health_status.toLowerCase() === 'invalid' || data.health_status.toLowerCase() === 'unknown' || data.health_status.toLowerCase() === 'error') {
            resStatusText.className = 'status-badge status-invalid';
            resStatusText.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Try Again';
        } else {
            resStatusText.className = 'status-badge status-diseased';
            resStatusText.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Diseased';
        }

        resDisease.textContent = data.disease;
        const confPercent = Math.round(data.confidence * 100) + '%';
        resConfidence.textContent = confPercent;
        
        // Timeout needed to trigger CSS transition inside newly visible container
        setTimeout(() => {
            resConfidenceBar.style.width = confPercent;
            // Add confidence color logic
            if (data.confidence >= 0.8) {
                resConfidenceBar.style.background = '#15803d'; // Green
            } else if (data.confidence >= 0.6) {
                resConfidenceBar.style.background = '#eab308'; // Yellow
            } else {
                resConfidenceBar.style.background = '#b91c1c'; // Red
            }
        }, 50);

        if (data.health_status.toLowerCase() === 'uncertain') {
            resAdvice.innerHTML = `<span style="color: #b91c1c; font-weight: bold;">⚠ Low confidence prediction</span><br/>${data.suggestion}`;
        } else {
            resAdvice.textContent = data.suggestion;
        }
    }
    
    // 5. Weather Forecast Logic
    const weatherCardsContainer = document.getElementById('weather-cards');
    const weatherLoadingSpinner = document.getElementById('weatherLoadingSpinner');
    const weatherError = document.getElementById('weatherError');

    function fetchWeatherForecast() {
        if (!weatherCardsContainer) return;
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    globalLat = position.coords.latitude;
                    globalLon = position.coords.longitude;
                    getWeatherData(globalLat, globalLon);
                },
                (error) => {
                    console.warn("Location access denied or failed. Attempting IP-based geolocation fallback.", error);
                    fallbackToIPLocation();
                },
                { enableHighAccuracy: false, maximumAge: 300000, timeout: 15000 }
            );
        } else {
            console.warn("Geolocation API not supported. Attempting IP-based geolocation fallback.");
            fallbackToIPLocation();
        }
    }

    function fallbackToIPLocation() {
        // Use a free IP geolocation API to get approximate location if browser permissions are denied
        fetch('https://get.geojs.io/v1/ip/geo.json')
            .then(res => res.json())
            .then(data => {
                if (data && data.latitude && data.longitude) {
                    globalLat = parseFloat(data.latitude);
                    globalLon = parseFloat(data.longitude);
                    getWeatherData(globalLat, globalLon);
                } else {
                    throw new Error("Invalid IP Geo data");
                }
            })
            .catch(err => {
                console.error("IP Geolocation failed. Loading default weather (New Delhi).", err);
                getWeatherData(28.6139, 77.2090); // Last resort fallback to New Delhi
            });
    }

    function getWeatherData(lat, lon) {
        // Also trigger the geographical map rendering and soil reversing
        reverseGeocode(lat, lon);

        // Try getting accurate local timezone, default to UTC if browser blocks it
        let tz = "UTC";
        try {
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch(e) {}

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=${encodeURIComponent(tz)}`;

        fetch(url)
            .then(res => {
                if (!res.ok) throw new Error("API Limit or Network Error");
                return res.json();
            })
            .then(data => {
                if (data && data.daily) {
                    displayWeather(data.daily);
                }
            })
            .catch(err => {
                console.error("Weather fetch error:", err);
                weatherLoadingSpinner.style.display = 'none';
                weatherError.style.display = 'block';
                weatherError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Error loading forecast. Check console for details.';
            });
    }

    function displayWeather(daily) {
        weatherLoadingSpinner.style.display = 'none';
        weatherCardsContainer.style.display = 'grid';
        weatherError.style.display = 'none';
        weatherCardsContainer.innerHTML = ''; // clear

        // Map Open-Meteo weather codes to FontAwesome icons
        const getWeatherIconInfo = (code) => {
            // Very simplified mapping
            if (code <= 3) return { html: '<i class="fa-solid fa-sun" style="color: #fbbf24;"></i>', desc: 'Sunny' };
            if (code <= 48) return { html: '<i class="fa-solid fa-cloud" style="color: #94a3b8;"></i>', desc: 'Cloudy' };
            if (code <= 67) return { html: '<i class="fa-solid fa-cloud-rain" style="color: #60a5fa;"></i>', desc: 'Rain' };
            if (code <= 77) return { html: '<i class="fa-regular fa-snowflake" style="color: #93c5fd;"></i>', desc: 'Snow' };
            if (code <= 82) return { html: '<i class="fa-solid fa-cloud-showers-heavy" style="color: #3b82f6;"></i>', desc: 'Heavy Rain' };
            if (code <= 99) return { html: '<i class="fa-solid fa-cloud-bolt" style="color: #818cf8;"></i>', desc: 'Storm' };
            return { html: '<i class="fa-solid fa-cloud-sun" style="color: #fbbf24;"></i>', desc: 'Variable' };
        };

        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        for (let i = 0; i < 7; i++) {
            // Safety check
            if (!daily.time[i]) continue;
            
            const dateObj = new Date(daily.time[i]);
            // Avoid off-by-one errors with UTC dates
            // (Open-Meteo returns yyyy-mm-dd which parses as UTC midnight)
            const dayName = daysOfWeek[dateObj.getUTCDay()];
            
            const maxTemp = Math.round(daily.temperature_2m_max[i]);
            const minTemp = Math.round(daily.temperature_2m_min[i]);
            const weatherIcon = getWeatherIconInfo(daily.weathercode[i]);

            const dayCard = document.createElement('div');
            dayCard.className = 'weather-day-card';
            dayCard.innerHTML = `
                <div class="weather-day-name">${i === 0 ? 'Today' : dayName}</div>
                <div class="weather-icon" title="${weatherIcon.desc}">${weatherIcon.html}</div>
                <div class="weather-temps">
                    <span class="max-temp">${maxTemp}°</span> <span class="min-temp" style="color:#9ca3af">${minTemp}°</span>
                </div>
            `;
            weatherCardsContainer.appendChild(dayCard);
        }
    }

    // Initialize map and weather automatically on load
    fetchWeatherForecast();
});
