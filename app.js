// ATENCIÓN: Reemplazar por la URL real que te dé Google Apps Script al publicar
const GAS_URL = "https://script.google.com/macros/s/AKfycbyjPUxpWtPZsvIndsMUQy62WBx1QVV0cnVnwSNAfCBzgDhi8RSE4jWwJuueTS5T3YoEQw/exec";

// Estado local
let currentUser = null;
let appData = {
    usuarios: [],
    clases: [],
    promociones: []
};

// Referencias DOM
const viewLogin = document.getElementById('view-login');
const viewAdmin = document.getElementById('view-admin');
const viewUser = document.getElementById('view-user');
const btnLogout = document.getElementById('btn-logout');
const loader = document.getElementById('loader');

function showLoader() { loader.classList.remove('hidden'); }
function hideLoader() { loader.classList.add('hidden'); }

function switchView(viewId) {
    viewLogin.classList.add('hidden');
    viewAdmin.classList.add('hidden');
    viewUser.classList.add('hidden');
    
    document.getElementById(viewId).classList.remove('hidden');
    
    if (viewId === 'view-login') {
        btnLogout.classList.add('hidden');
    } else {
        btnLogout.classList.remove('hidden');
    }
}

// Fetch general a Google Apps Script
async function fetchGAS(action, payload = {}) {
    if (GAS_URL === "URL_DE_TU_WEB_APP") {
        console.warn("Falta configurar la URL de GAS. Usando datos falsos de prueba.");
        return mockData(action, payload);
    }
    
    try {
        const res = await fetch(`${GAS_URL}?action=${action}`, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        return await res.json();
    } catch (e) {
        console.error(e);
        alert("Error de conexión");
        return null;
    }
}

// Lógica de Login
document.getElementById('btn-login').addEventListener('click', async () => {
    const phone = document.getElementById('input-phone').value.trim();
    if (!phone) return;
    
    showLoader();
    const res = await fetchGAS('login', { phone });
    hideLoader();

    if (res && res.success) {
        currentUser = res.user;
        appData = res.data;
        
        if (currentUser.Rol === 'Admin') {
            renderAdminPanel();
            switchView('view-admin');
        } else {
            renderUserPanel();
            switchView('view-user');
        }
    } else {
        document.getElementById('login-error').classList.remove('hidden');
    }
});

btnLogout.addEventListener('click', () => {
    currentUser = null;
    document.getElementById('input-phone').value = '';
    document.getElementById('login-error').classList.add('hidden');
    switchView('view-login');
});

// Render Panel Dueño (Admin)
function renderAdminPanel() {
    const container = document.getElementById('admin-users-container');
    container.innerHTML = '';
    
    appData.usuarios.forEach(u => {
        if (u.Rol === 'Admin') return; // no mostrar admins
        
        // Parsear fecha DD/MM/YYYY o YYYY-MM-DD
        let fPago;
        if(u.FechaProximoPago && u.FechaProximoPago.includes('/')){
            const [d,m,y] = u.FechaProximoPago.split('/');
            fPago = new Date(`${y}-${m}-${d}T00:00:00`);
        } else {
            fPago = new Date(`${u.FechaProximoPago}T00:00:00`);
        }

        const hoy = new Date();
        hoy.setHours(0,0,0,0);
        
        const diffTime = fPago - hoy;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let alertClass = '';
        let buttonsHTML = '';
        
        if (u.WhatsApp) {
            const reminderMsg = encodeURIComponent(`Hola ${u.Nombre}, estas en los ultimos días de tu membresia, te invito a no perder tu progreso y continuar por una mejor version de ti`);
            buttonsHTML += `<a href="https://wa.me/${u.WhatsApp}?text=${reminderMsg}" target="_blank" class="btn-whatsapp" style="background-color: var(--mexican-green); margin-bottom: 5px;">Recordar</a>`;
        }
        
        // Si faltan 5 días o menos para pagar
        if (diffDays <= 5) {
            alertClass = 'alert';
            if (u.WhatsApp) {
                const msg = encodeURIComponent(`Hola ${u.Nombre}, te recordamos que tu mensualidad en H22 Studio vence en ${diffDays} días (${u.FechaProximoPago}). Puedes realizar tu transferencia a la cuenta: [TU CUENTA]. ¡Gracias, Gorilla!`);
                buttonsHTML += `<a href="https://wa.me/${u.WhatsApp}?text=${msg}" target="_blank" class="btn-whatsapp">Cobrar</a>`;
            }
        } else if (isNaN(diffDays)){
            buttonsHTML += `<span style="color:gray; font-size:0.8rem; display:block; margin-top:5px;">Fecha inválida</span>`;
        }

        container.innerHTML += `
            <div class="user-card ${alertClass}">
                <div class="user-info">
                    <h4>${u.Nombre}</h4>
                    <p>Vence: ${u.FechaProximoPago} (${isNaN(diffDays)?'--':diffDays} días)</p>
                    <p>Cel: ${u.WhatsApp} | Fijo: ${u.HorarioFijo}</p>
                </div>
                <div style="display: flex; flex-direction: column; align-items: flex-end;">${buttonsHTML}</div>
            </div>
        `;
    });
}

// Modal Agregar Usuario
const modalAddUser = document.getElementById('modal-add-user');
document.getElementById('btn-show-add-user').addEventListener('click', () => {
    modalAddUser.classList.remove('hidden');
});

document.querySelectorAll('.btn-close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        modalAddUser.classList.add('hidden');
        document.getElementById('modal-schedule').classList.add('hidden');
    });
});

document.getElementById('btn-save-user').addEventListener('click', async () => {
    const nombre = document.getElementById('new-user-name').value;
    const phone = document.getElementById('new-user-phone').value;
    const date = document.getElementById('new-user-date').value;
    const schedule = document.getElementById('new-user-schedule').value;
    
    if(!nombre || !phone || !date || !schedule) return alert("Completa todos los campos");

    // Calcular próximo pago (+30 dias)
    const fechaIngreso = new Date(`${date}T12:00:00`);
    fechaIngreso.setDate(fechaIngreso.getDate() + 30);
    const fechaPago = fechaIngreso.toISOString().split('T')[0];

    showLoader();
    const res = await fetchGAS('addUser', {
        Nombre: nombre, WhatsApp: phone, FechaIngreso: date, 
        FechaProximoPago: fechaPago, HorarioFijo: schedule, Rol: 'Usuario'
    });
    hideLoader();

    if (res && res.success) {
        appData.usuarios.push(res.newUser);
        renderAdminPanel();
        modalAddUser.classList.add('hidden');
        alert("Alumno guardado correctamente");
    } else {
        alert("Error al guardar alumno");
    }
});

// Render Panel Usuario
function renderUserPanel() {
    document.getElementById('user-name-display').innerText = `Hola, ${currentUser.Nombre.split(' ')[0]}!`;
    document.getElementById('user-payment-date').innerText = currentUser.FechaProximoPago || '--';
    
    // Promociones
    const promoContainer = document.getElementById('user-promos-container');
    promoContainer.innerHTML = '';
    appData.promociones.forEach(p => {
        const msg = encodeURIComponent(`Hola, vengo de la app de H22 Studio y me interesa la promo: ${p.Producto}`);
        promoContainer.innerHTML += `
            <div class="promo-card">
                ${p.Imagen ? `<img src="${p.Imagen}" class="promo-img" alt="${p.Producto}">` : ''}
                <h4>${p.Empresa}</h4>
                <p style="margin-bottom:10px">${p.Producto} - <strong style="color:var(--neon-green)">${p.Precio}</strong></p>
                <a href="https://wa.me/${p.WhatsApp}?text=${msg}" target="_blank" class="btn-whatsapp">Lo quiero</a>
            </div>
        `;
    });
    
    // Clases
    const classContainer = document.getElementById('user-classes-container');
    classContainer.innerHTML = `
        <div class="class-card">
            <div class="user-info">
                <h4>Tu Horario Fijo</h4>
                <p>${currentUser.HorarioFijo || 'No asignado'}</p>
            </div>
            <button class="btn-cancel" onclick="alert('Funcionalidad para liberar tu lugar a otro usuario.')">Faltaré</button>
        </div>
    `;
}

// Modal Agendar Extra
document.getElementById('btn-schedule-extra').addEventListener('click', () => {
    const classContainer = document.getElementById('available-classes-container');
    classContainer.innerHTML = '';
    
    if(appData.clases.length === 0){
        classContainer.innerHTML = "<p>No hay clases disponibles.</p>";
    }

    appData.clases.forEach(c => {
        classContainer.innerHTML += `
            <div class="class-card" style="margin-bottom: 10px;">
                <div class="user-info">
                    <h4>${c.Dia} - ${c.Hora}</h4>
                    <p>Coach: ${c.Instructor || '--'}</p>
                </div>
                <button class="btn-secondary" style="width: auto;" onclick="agendarExtra('${c.ID}')">Agendar</button>
            </div>
        `;
    });
    
    document.getElementById('modal-schedule').classList.remove('hidden');
});

async function agendarExtra(idClase) {
    if(!confirm("¿Deseas agendar este horario extra?")) return;
    
    showLoader();
    const res = await fetchGAS('agendarExtra', { phone: currentUser.WhatsApp, idClase });
    hideLoader();
    if(res && res.success) {
        alert("¡Agendado con éxito!");
        document.getElementById('modal-schedule').classList.add('hidden');
    } else {
        alert(res.error || "Error al agendar");
    }
}

// Mensaje Difusión (Boton Admin)
document.getElementById('btn-show-broadcast').addEventListener('click', () => {
    window.open("https://wa.me/526621286485", "_blank");
});

// Mock Data para pruebas locales
function mockData(action, payload) {
    return new Promise(resolve => {
        setTimeout(() => {
            if (action === 'login') {
                if (payload.phone === 'admin') {
                    resolve({ success: true, user: { Nombre: "Dueño H22", WhatsApp: "admin", Rol: "Admin" }, data: mockDB });
                } else if (payload.phone === '123') {
                    resolve({ success: true, user: mockDB.usuarios[0], data: mockDB });
                } else {
                    resolve({ success: false });
                }
            } else if (action === 'addUser') {
                resolve({ success: true, newUser: Object.assign({ID: "U999"}, payload) });
            } else if (action === 'agendarExtra') {
                resolve({ success: true });
            }
        }, 800);
    });
}

const mockDB = {
    usuarios: [
        { Nombre: "Juan Perez (Prueba)", WhatsApp: "123", FechaProximoPago: "2024-05-15", HorarioFijo: "L-V 7:00 AM", Rol: "Usuario" },
        { Nombre: "Maria Gomez", WhatsApp: "456", FechaProximoPago: "2024-06-10", HorarioFijo: "L-V 8:00 AM", Rol: "Usuario" }
    ],
    clases: [
        { ID: "C1", Dia: "Lunes", Hora: "6:00 PM", Instructor: "Mike" },
        { ID: "C2", Dia: "Martes", Hora: "7:00 AM", Instructor: "Sarah" }
    ],
    promociones: [
        { Empresa: "Suples Fit", Producto: "Proteina Whey", Precio: "$900", WhatsApp: "9999999", Imagen: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" }
    ]
};
