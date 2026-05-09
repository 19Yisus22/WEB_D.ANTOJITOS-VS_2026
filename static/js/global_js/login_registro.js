const form = document.getElementById("loginForm") || document.getElementById("registerForm");
const togglePassword = document.getElementById("togglePassword");
const passwordInput = document.getElementById("contrasena");
const linkRegistro = document.getElementById("linkRegistro");
const linkInicio = document.getElementById("linkInicio");

const onlyLettersRegex = /^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/;
const onlyDigitsRegex = /^\d+$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function actualizarConexionDB(userId) {
    if (!userId) return;
    try {
        await fetch(`/actualizar_conexion/${userId}`, { 
            method: "PUT",
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        console.warn("Error al registrar última conexión");
    }
}

function updatePasswordStrength(password) {
    const strengthBar = document.getElementById("passwordStrengthBar");
    if (!strengthBar) return;

    let width = 0;
    let color = "#e53e3e";

    if (password.length >= 6) {
        width = 33;
        color = "#e53e3e";
    }
    if (password.length >= 10) {
        width = 66;
        color = "#f6e05e";
    }
    if (password.length >= 15) {
        width = 100;
        color = "#48bb78";
    }

    strengthBar.style.width = width + "%";
    strengthBar.style.backgroundColor = color;
}

if (passwordInput) {
    passwordInput.addEventListener("input", (e) => {
        updatePasswordStrength(e.target.value);
    });
}

function playNotificationSound(isError = false) {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const mainGain = audioCtx.createGain();
        mainGain.gain.setValueAtTime(0, audioCtx.currentTime);
        mainGain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
        mainGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

        const osc1 = audioCtx.createOscillator();
        if (isError) {
            osc1.type = 'sawtooth';
            osc1.frequency.setValueAtTime(150, audioCtx.currentTime);
            osc1.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.4);
        } else {
            osc1.type = 'triangle';
            osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
            const osc2 = audioCtx.createOscillator();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime);
            osc2.connect(mainGain);
            osc2.start();
            osc2.stop(audioCtx.currentTime + 1.2);
        }
        osc1.connect(mainGain);
        mainGain.connect(audioCtx.destination);
        osc1.start();
        osc1.stop(audioCtx.currentTime + 1.2);
    } catch (e) { }
}

function showMessage(titulo, msg, isSuccess = true) {
    let cont = document.getElementById("toastContainer");
    if (!cont) {
        cont = document.createElement("div");
        cont.id = "toastContainer";
        cont.className = "position-fixed bottom-0 start-0 p-3";
        cont.style.zIndex = "1080";
        document.body.appendChild(cont);
    }
    playNotificationSound(!isSuccess);
    const t = document.createElement("div");
    t.className = "custom-toast show shadow-lg mb-3";
    t.style.minWidth = "300px";
    t.style.borderRadius = "15px";
    t.style.backgroundColor = "#ffffff";
    t.style.borderLeft = `6px solid ${isSuccess ? '#f1a7b9' : '#e53e3e'}`;
    t.style.padding = "15px";
    t.style.transition = "all 0.4s ease";
    const accentColor = isSuccess ? '#d85a76' : '#e53e3e';
    const iconClass = isSuccess ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill';
    t.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="flex-shrink-0 me-3">
                <i class="bi ${iconClass}" style="color: ${accentColor}; font-size: 1.6rem;"></i>
            </div>
            <div class="flex-grow-1">
                <strong style="color: #5d4037; font-size: 0.95rem; display: block;">${titulo}</strong>
                <small style="color: #a67c83; font-size: 0.85rem;">${msg}</small>
            </div>
            <i class="bi bi-x-lg ms-2 btn-close-toast" style="cursor:pointer; font-size: 0.75rem; color: #bdc3c7;"></i>
        </div>`;
    cont.appendChild(t);
    const remove = () => {
        t.style.opacity = '0';
        t.style.transform = 'translateX(-30px)';
        setTimeout(() => t.remove(), 400);
    };
    t.querySelector('.btn-close-toast').onclick = remove;
    setTimeout(remove, 5000);
}

async function handleCredentialResponse(response) {
    setLoading(true);
    try {
        const res = await fetch("/registro-google", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential })
        });
        const data = await res.json();
        if (data.ok) {
            await actualizarConexionDB(data.user.id_cliente);
            sessionStorage.setItem("user", JSON.stringify(data.user));
            showMessage("¡Bienvenido!", `Hola, ${data.user.nombre}`, true);
            setTimeout(() => { window.location.href = "/inicio"; }, 1500);
        } else {
            showMessage("Error", data.error || "Error al validar", false);
            setLoading(false);
        }
    } catch (err) {
        showMessage("Error", "Error de conexión", false);
        setLoading(false);
    }
}

function renderGoogleButton(clientId) {
    if (!window.google || !document.getElementById("buttonDiv")) return;

    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
        auto_select: false,
        context: "signin"
    });

    const buttonDiv = document.getElementById("buttonDiv");
    const loadingDiv = document.getElementById("googleLoading");

    if (loadingDiv) loadingDiv.style.display = 'none';

    google.accounts.id.renderButton(buttonDiv, { 
        theme: "outline", 
        size: "large", 
        shape: "pill", 
        width: buttonDiv.offsetWidth 
    });
}

async function inicializarGoogle() {
    try {
        const res = await fetch("/obtener-cliente-id");
        const data = await res.json();
        
        if (data.client_id) {
            if (window.google) {
                renderGoogleButton(data.client_id);
            } else {
                const script = document.querySelector('script[src*="gsi/client"]');
                if (script) {
                    script.onload = () => renderGoogleButton(data.client_id);
                }
            }
        } else {
            const loadingDiv = document.getElementById("googleLoading");
            if (loadingDiv) {
                loadingDiv.innerHTML = '<i class="bi bi-exclamation-triangle text-warning me-2"></i>Botón no disponible';
            }
        }
    } catch (err) {
        const loadingDiv = document.getElementById("googleLoading");
        if (loadingDiv) {
            loadingDiv.innerHTML = '<i class="bi bi-exclamation-triangle text-danger me-2"></i>Error al cargar';
        }
    }
}

function setLoading(isLoading) {
    const btn = document.getElementById("btnSubmitLogin") || document.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = isLoading;
    if (isLoading) {
        btn.dataset.original = btn.innerHTML;
        btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Cargando...`;
    } else {
        btn.innerHTML = btn.dataset.original || btn.innerHTML;
    }
}

if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", function () {
        const isPassword = passwordInput.getAttribute("type") === "password";
        passwordInput.setAttribute("type", isPassword ? "text" : "password");
        this.classList.toggle("bi-eye");
        this.classList.toggle("bi-eye-slash");
    });
}

if (form) {
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const isLogin = form.id === "loginForm";
        const endpoint = isLogin ? "/login" : "/registro";
        
        const correo = document.getElementById("correo").value.trim().toLowerCase();
        const contrasena = document.getElementById("contrasena").value;
        
        if (!correo || !contrasena) {
            showMessage("Campos Incompletos", "Llena los datos necesarios", false);
            return;
        }

        if (contrasena.length < 6) {
            showMessage("Contraseña Débil", "Mínimo 6 caracteres", false);
            return;
        }

        let datos = { correo, contrasena };

        if (!isLogin) {
            const cedula = document.getElementById("cedula").value.trim();
            const telefono = document.getElementById("telefono").value.trim();
            const nombre = document.getElementById("nombre").value.trim();
            const apellido = document.getElementById("apellido").value.trim();

            if (!nombre || !onlyLettersRegex.test(nombre)) {
                showMessage("Nombre inválido", "El nombre debe contener solo letras", false);
                return;
            }
            if (!apellido || !onlyLettersRegex.test(apellido)) {
                showMessage("Apellido inválido", "El apellido debe contener solo letras", false);
                return;
            }
            if (!onlyDigitsRegex.test(cedula) || cedula.length < 6) {
                showMessage("Cédula inválida", "Solo números y al menos 6 dígitos", false);
                return;
            }
            if (!onlyDigitsRegex.test(telefono) || telefono.length < 10) {
                showMessage("Teléfono inválido", "Solo números y al menos 10 dígitos", false);
                return;
            }
            if (!emailPattern.test(correo)) {
                showMessage("Correo inválido", "Ingresa un correo electrónico válido", false);
                return;
            }

            datos = { cedula, nombre, apellido, correo, telefono, contrasena };
        }

        setLoading(true);

        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datos)
            });
            const data = await res.json();
            
            if (res.ok && data.ok) {
                if (isLogin) {
                    await actualizarConexionDB(data.user.id_cliente);
                    sessionStorage.setItem("user", JSON.stringify(data.user));
                    showMessage("¡Bienvenido!", `Hola, ${data.user.nombre}`, true);
                } else {
                    showMessage("Cuenta Creada", "Ya puedes iniciar sesión", true);
                }
                setTimeout(() => {
                    window.location.href = isLogin ? (data.redirect || "/inicio") : "/login";
                }, 1600);
            } else {
                showMessage("Error", data.error || "Verifica tus datos", false);
                setLoading(false);
            }
        } catch (err) {
            showMessage("Error", "Error de servidor", false);
            setLoading(false);
        }
    });
}

(function() {
    if (window.location.search.includes('logout=true')) {
        sessionStorage.clear();
        localStorage.clear();
    }
    
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", inicializarGoogle);
    } else {
        inicializarGoogle();
    }

    window.onpageshow = function(event) {
        if (event.persisted) {
            inicializarGoogle();
        }
    };
})();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {navigator.serviceWorker.register('/static/js/workers/service-worker-login.js') .then(() => console.log('SW OK')) .catch(err => console.error('SW Error', err));});
}