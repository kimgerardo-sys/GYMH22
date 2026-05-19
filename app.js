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
        document.getElementById('modal-day-options').classList.add('hidden');
        document.getElementById('modal-payment').classList.add('hidden');
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
// Estado del calendario
let calendarCurrentDate = new Date();

// Helper para parsear fechas
function parseDateString(dateStr) {
    if (!dateStr) return new Date();
    if (dateStr.includes('/')) {
        const [d, m, y] = dateStr.split('/');
        return new Date(`${y}-${m}-${d}T00:00:00`);
    }
    return new Date(`${dateStr}T00:00:00`);
}

// Helper para formatear fechas a YYYY-MM-DD
function formatDateString(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Obtener el horario en texto limpio (ej: "7:00 AM" desde "L-V 7:00 AM")
function getHourFromSchedule(schedStr) {
    if (!schedStr) return '';
    const parts = schedStr.split(' ');
    if (parts.length > 1) {
        return parts.slice(1).join(' ');
    }
    return schedStr;
}

// Obtener el estado del día para el usuario actual: 'fixed', 'canceled', 'rescheduled'
function getUserDateStatus(dateStr) {
    const userRes = (appData.reservas || []).filter(r => r.WhatsApp === currentUser.WhatsApp && r.Fecha === dateStr);
    const hasRes = userRes.some(r => r.Tipo === 'Reserva');
    if (hasRes) return 'rescheduled';
    
    const hasCancel = userRes.some(r => r.Tipo === 'Cancelacion');
    if (hasCancel) return 'canceled';
    
    return 'fixed';
}

// Obtener la clase del usuario actual para un día específico
function getUserScheduleForDate(dateStr) {
    const status = getUserDateStatus(dateStr);
    if (status === 'fixed') {
        return getHourFromSchedule(currentUser.HorarioFijo);
    } else if (status === 'rescheduled') {
        const booking = (appData.reservas || []).find(r => r.WhatsApp === currentUser.WhatsApp && r.Fecha === dateStr && r.Tipo === 'Reserva');
        return booking ? booking.Hora : null;
    }
    return null;
}

// Obtener cupo libre para un horario en una fecha
function getRemainingSpots(dateStr, hourStr) {
    let fixedCount = 0;
    appData.usuarios.forEach(u => {
        if (u.Rol === 'Admin') return;
        const uHour = getHourFromSchedule(u.HorarioFijo);
        if (uHour === hourStr) {
            const uCancelled = (appData.reservas || []).some(r => r.WhatsApp === u.WhatsApp && r.Fecha === dateStr && r.Tipo === 'Cancelacion');
            if (!uCancelled) {
                fixedCount++;
            }
        }
    });
    
    let reserveCount = 0;
    (appData.reservas || []).forEach(r => {
        if (r.Fecha === dateStr && r.Hora === hourStr && r.Tipo === 'Reserva') {
            reserveCount++;
        }
    });
    
    const totalOccupied = fixedCount + reserveCount;
    return Math.max(0, 8 - totalOccupied); // 6 + 2 extra = 8 cupo máximo
}

// Generar Calendario de 5 columnas (L-V)
function renderCalendar() {
    const calendarDays = document.getElementById('calendar-days');
    const monthYearDisplay = document.getElementById('calendar-month-year');
    calendarDays.innerHTML = '';
    
    const year = calendarCurrentDate.getFullYear();
    const month = calendarCurrentDate.getMonth();
    
    const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    monthYearDisplay.innerText = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const firstDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
    
    // Relleno para alinear el primer día en Lunes-Viernes
    let padding = 0;
    if (firstDayOfWeek >= 1 && firstDayOfWeek <= 5) {
        padding = firstDayOfWeek - 1;
    } else if (firstDayOfWeek === 0) {
        padding = 0; // Inicia en lunes
    } else if (firstDayOfWeek === 6) {
        padding = 0; // Inicia en lunes
    }
    
    for (let i = 0; i < padding; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day inactive';
        calendarDays.appendChild(emptyCell);
    }
    
    const lastDay = new Date(year, month + 1, 0).getDate();
    const signupDate = parseDateString(currentUser.FechaIngreso);
    const renewDate = parseDateString(currentUser.FechaProximoPago);
    signupDate.setHours(0,0,0,0);
    renewDate.setHours(0,0,0,0);
    
    const today = new Date();
    today.setHours(0,0,0,0);
    
    for (let d = 1; d <= lastDay; d++) {
        const currentDate = new Date(year, month, d);
        const dayOfWeek = currentDate.getDay();
        
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            continue; // Saltar fines de semana
        }
        
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.innerText = d;
        
        const dateStr = formatDateString(currentDate);
        const inActiveRange = currentDate >= signupDate && currentDate < renewDate;
        
        if (!inActiveRange) {
            dayCell.classList.add('inactive');
        } else {
            if (currentDate.getTime() === today.getTime()) {
                dayCell.classList.add('today');
            }
            
            const classTime = getUserScheduleForDate(dateStr);
            const status = getUserDateStatus(dateStr);
            
            if (status === 'fixed') {
                dayCell.classList.add('fixed');
            } else if (status === 'canceled') {
                dayCell.classList.add('canceled');
            } else if (status === 'rescheduled') {
                dayCell.classList.add('rescheduled');
            }
            
            dayCell.addEventListener('click', () => {
                openDayModal(currentDate, dateStr, status, classTime);
            });
        }
        
        calendarDays.appendChild(dayCell);
    }
}

// Abrir Modal de Opciones del Día
function openDayModal(date, dateStr, status, classTime) {
    const modal = document.getElementById('modal-day-options');
    const title = document.getElementById('modal-day-title');
    const info = document.getElementById('day-status-info');
    const container = document.getElementById('day-actions-container');
    
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    title.innerText = date.toLocaleDateString('es-ES', options);
    
    container.innerHTML = '';
    
    if (status === 'fixed') {
        info.innerHTML = `Tienes programado tu horario fijo a las <strong style="color:var(--neon-green)">${classTime}</strong>.`;
        container.innerHTML = `
            <button class="btn-cancel" style="border-color:#ff4d4d; color:#ff4d4d;" onclick="cancelarClaseDia('${dateStr}', '${classTime}', 'fixed')">
                Liberar/Cancelar Clase de Hoy
            </button>
        `;
    } else if (status === 'rescheduled') {
        info.innerHTML = `Tienes una clase reagendada a las <strong style="color:var(--neon-green)">${classTime}</strong>.`;
        container.innerHTML = `
            <button class="btn-cancel" style="border-color:#ff4d4d; color:#ff4d4d;" onclick="cancelarClaseDia('${dateStr}', '${classTime}', 'rescheduled')">
                Cancelar Reagendado (Volver a Liberar)
            </button>
        `;
    } else if (status === 'canceled') {
        info.innerHTML = `Has liberado tu horario de este día. <br>Elige una hora disponible para recuperar/reagendar:`;
        
        const CLASS_HOURS = [
            "5:00 AM", "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM",
            "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"
        ];
        
        CLASS_HOURS.forEach(hr => {
            const spots = getRemainingSpots(dateStr, hr);
            const isFull = spots <= 0;
            
            const btn = document.createElement('button');
            btn.className = `btn-day-action ${isFull ? 'full-capacity' : ''}`;
            btn.disabled = isFull;
            btn.innerHTML = `
                <span>Clase ${hr}</span>
                <span class="badge-capacity">${isFull ? 'Lleno' : `${spots} disp.`}</span>
            `;
            
            if (!isFull) {
                btn.addEventListener('click', () => {
                    reservarClaseDia(dateStr, hr);
                });
            }
            container.appendChild(btn);
        });
    }
    
    modal.classList.remove('hidden');
}

// Cancelar clase del día
async function cancelarClaseDia(dateStr, hourStr, status) {
    if (!confirm("¿Deseas liberar/cancelar tu clase para este día?")) return;
    
    showLoader();
    const res = await fetchGAS('cancelarClase', { phone: currentUser.WhatsApp, fecha: dateStr, hora: hourStr, tipo: status });
    hideLoader();
    
    if (res && res.success) {
        if (status === 'fixed') {
            appData.reservas.push({ Fecha: dateStr, Hora: hourStr, WhatsApp: currentUser.WhatsApp, Tipo: 'Cancelacion' });
        } else {
            appData.reservas = appData.reservas.filter(r => !(r.Fecha === dateStr && r.WhatsApp === currentUser.WhatsApp && r.Tipo === 'Reserva'));
        }
        alert("Clase liberada con éxito. Ya puedes elegir otro horario.");
        document.getElementById('modal-day-options').classList.add('hidden');
        renderCalendar();
    } else {
        alert("Error al liberar clase");
    }
}

// Reservar clase en día cancelado
async function reservarClaseDia(dateStr, hourStr) {
    if (!confirm(`¿Deseas agendar a las ${hourStr} en este día?`)) return;
    
    showLoader();
    const res = await fetchGAS('reservarClase', { phone: currentUser.WhatsApp, fecha: dateStr, hora: hourStr });
    hideLoader();
    
    if (res && res.success) {
        appData.reservas.push({ Fecha: dateStr, Hora: hourStr, WhatsApp: currentUser.WhatsApp, Tipo: 'Reserva' });
        alert("¡Clase reagendada con éxito!");
        document.getElementById('modal-day-options').classList.add('hidden');
        renderCalendar();
    } else {
        alert(res?.error || "Error al agendar");
    }
}

// Render Panel Usuario
function renderUserPanel() {
    document.getElementById('user-name-display').innerText = `Hola, ${currentUser.Nombre.split(' ')[0]}!`;
    document.getElementById('user-payment-date').innerText = currentUser.FechaProximoPago || '--';
    
    // Fechas de membresía
    document.getElementById('user-signup-date').innerText = currentUser.FechaIngreso || '--';
    document.getElementById('user-expire-date').innerText = currentUser.FechaProximoPago || '--';
    
    // Promociones (Beneficios H22 Premium)
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
    
    // Clases / Horario Fijo
    const classContainer = document.getElementById('user-classes-container');
    classContainer.innerHTML = `
        <div class="class-card">
            <div class="user-info">
                <h4>Tu Horario Fijo Asignado</h4>
                <p>${currentUser.HorarioFijo || 'No asignado'}</p>
            </div>
            <span style="color:var(--neon-green); font-size:0.85rem; font-weight:600;">Lunes a Viernes</span>
        </div>
    `;
    
    // Inicializar y dibujar calendario
    calendarCurrentDate = new Date();
    renderCalendar();
}

// Configuración de navegadores del calendario
document.getElementById('btn-prev-month').addEventListener('click', () => {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() - 1);
    renderCalendar();
});

document.getElementById('btn-next-month').addEventListener('click', () => {
    calendarCurrentDate.setMonth(calendarCurrentDate.getMonth() + 1);
    renderCalendar();
});

// Configuración del Modal de Pago
document.getElementById('btn-show-payment').addEventListener('click', () => {
    document.getElementById('modal-payment').classList.remove('hidden');
});

document.getElementById('btn-close-payment').addEventListener('click', () => {
    document.getElementById('modal-payment').classList.add('hidden');
});

document.getElementById('btn-copy-card').addEventListener('click', () => {
    const cardNumber = document.getElementById('input-card-number').value;
    navigator.clipboard.writeText(cardNumber).then(() => {
        alert("Número de cuenta copiado al portapapeles: " + cardNumber);
    }).catch(err => {
        console.error("Error al copiar al portapapeles: ", err);
    });
});

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
            } else if (action === 'cancelarClase') {
                if (payload.tipo === 'fixed') {
                    mockDB.reservas.push({ Fecha: payload.fecha, Hora: payload.hora, WhatsApp: payload.phone, Tipo: 'Cancelacion' });
                } else {
                    mockDB.reservas = mockDB.reservas.filter(r => !(r.Fecha === payload.fecha && r.WhatsApp === payload.phone && r.Tipo === 'Reserva'));
                }
                resolve({ success: true });
            } else if (action === 'reservarClase') {
                mockDB.reservas.push({ Fecha: payload.fecha, Hora: payload.hora, WhatsApp: payload.phone, Tipo: 'Reserva' });
                resolve({ success: true });
            }
        }, 800);
    });
}

const mockDB = {
    usuarios: [
        { Nombre: "Juan Perez (Prueba)", WhatsApp: "123", FechaIngreso: "2026-05-01", FechaProximoPago: "2026-05-31", HorarioFijo: "L-V 7:00 AM", Rol: "Usuario" },
        { Nombre: "Maria Gomez", WhatsApp: "456", FechaIngreso: "2026-05-10", FechaProximoPago: "2026-06-09", HorarioFijo: "L-V 8:00 AM", Rol: "Usuario" }
    ],
    clases: [
        { ID: "C1", Dia: "Lunes", Hora: "6:00 PM", Clase: "Mike" },
        { ID: "C2", Dia: "Martes", Hora: "7:00 AM", Clase: "Sarah" }
    ],
    promociones: [
        { Empresa: "Suples Fit", Producto: "Proteina Whey", Precio: "$900", WhatsApp: "9999999", Imagen: "https://images.unsplash.com/photo-1593095948071-474c5cc2989d?ixlib=rb-4.0.3&auto=format&fit=crop&w=300&q=80" }
    ],
    reservas: [
        { Fecha: "2026-05-15", Hora: "7:00 AM", WhatsApp: "123", Tipo: "Cancelacion" },
        { Fecha: "2026-05-15", Hora: "8:00 AM", WhatsApp: "123", Tipo: "Reserva" }
    ]
};
