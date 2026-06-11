
(() => {
    const _pf = {
        cedula:   window.PAGE_DATA.userId,
        archivos: [],
        LIMITE:   100 * 1024 * 1024,

        el(id) { return document.getElementById(id); },

        fmt(b) {
            if (!b) return '0 B';
            if (b < 1024) return b + ' B';
            if (b < 1048576) return (b/1024).toFixed(1) + ' KB';
            return (b/1048576).toFixed(2) + ' MB';
        },

        fmtDate(iso) {
            if (!iso) return '';
            try { return new Date(iso).toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}); }
            catch { return ''; }
        },

        iconInfo(nombre) {
            if (typeof _fileIconInfo === 'function') return _fileIconInfo(nombre);
            return { icon:'bi-file-earmark-fill', color:'#95a5a6' };
        },

        totalBytes() { return this.archivos.reduce((s,a) => s+(a.tamanio||0), 0); },

        updateHeader() {
            const total = this.totalBytes();
            const n = this.archivos.length;
            const c = this.el('archivosCount');
            if (c) c.textContent = n + ' archivo' + (n!==1?'s':'');
            const st = this.el('pfStorageText');
            if (st) st.textContent = this.fmt(total) + ' / 100 MB usado';
            const ft = this.el('pfFooter');
            if (ft) ft.style.display = 'flex';
            this._checkLimit(total);
        },

        _checkLimit(total) {
            total = total ?? this.totalBytes();
            const lbl   = this.el('pfUploadLabel');
            const input = this.el('pfFileInput');
            const warn  = this.el('pfLimitWarning');
            const over  = total >= this.LIMITE;
            if (lbl) {
                lbl.style.opacity        = over ? '0.45' : '';
                lbl.style.pointerEvents  = over ? 'none' : '';
                lbl.style.cursor         = over ? 'not-allowed' : '';
                lbl.title = over ? 'Límite de 100 MB alcanzado. Elimina archivos para subir más.' : 'Subir archivo';
            }
            if (input) input.disabled = over;
            if (warn)  warn.style.display = over ? 'flex' : 'none';
        },

        render() {
            const lista   = this.el('archivosLista');
            const empty   = this.el('archivosEmpty');
            const loading = this.el('archivosLoading');
            if (!lista) return;
            if (loading) loading.style.display = 'none';
            lista.innerHTML = '';
            this.updateHeader();
            if (!this.archivos.length) {
                if (empty) empty.style.display = 'flex';
                return;
            }
            if (empty) empty.style.display = 'none';
            this.archivos.forEach((a, idx) => {
                const info = this.iconInfo(a.nombre);
                const li   = document.createElement('li');
                li.className = 'pf-file-item';
                li.dataset.idx = idx;
                li.innerHTML = `
                    <i class="bi ${info.icon} pf-file-type-icon" style="color:${info.color};"></i>
                    <div class="pf-file-body">
                        <div class="pf-file-name-wrap">
                            <span class="pf-file-name" title="${a.nombre}">${a.nombre}</span>
                            <input class="pf-file-rename-input" value="${a.nombre}" style="display:none;" maxlength="120">
                        </div>
                        <div class="pf-file-meta">${[this.fmt(a.tamanio), this.fmtDate(a.subido_en)].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div class="pf-file-actions">
                        <a href="/api/usuarios/${this.cedula}/descargar?pub=${encodeURIComponent(a.public_id)}" class="pf-action-btn pf-btn-dl" title="Descargar">
                            <i class="bi bi-download"></i>
                        </a>
                        <button class="pf-action-btn pf-btn-edit" title="Renombrar">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="pf-action-btn pf-btn-del" title="Eliminar">
                            <i class="bi bi-trash3-fill"></i>
                        </button>
                    </div>`;

                const nameSpan   = li.querySelector('.pf-file-name');
                const nameInput  = li.querySelector('.pf-file-rename-input');
                const btnEdit    = li.querySelector('.pf-btn-edit');
                const btnDel     = li.querySelector('.pf-btn-del');

                btnEdit.addEventListener('click', () => {
                    const editing = li.classList.contains('pf-editing');
                    if (editing) {
                        this.guardarNombre(li, a, nameInput);
                    } else {
                        li.classList.add('pf-editing');
                        nameSpan.style.display   = 'none';
                        nameInput.style.display  = '';
                        nameInput.value = a.nombre;
                        nameInput.focus();
                        nameInput.select();
                        btnEdit.innerHTML = '<i class="bi bi-check2-all"></i>';
                        btnEdit.title = 'Guardar nombre';
                    }
                });

                nameInput.addEventListener('keydown', e => {
                    if (e.key === 'Enter')  { e.preventDefault(); this.guardarNombre(li, a, nameInput); }
                    if (e.key === 'Escape') { this.cancelarEdicion(li, a, nameSpan, nameInput, btnEdit); }
                });

                btnDel.addEventListener('click', () => {
                    mostrarConfirmacionApp('Eliminar archivo', `¿Eliminar <strong>${a.nombre}</strong>?`, async () => {
                        await this.eliminar(a.public_id);
                    });
                });

                lista.appendChild(li);
            });
        },

        cancelarEdicion(li, a, span, input, btn) {
            li.classList.remove('pf-editing');
            span.style.display  = '';
            input.style.display = 'none';
            input.value         = a.nombre;
            btn.innerHTML = '<i class="bi bi-pencil"></i>';
            btn.title = 'Renombrar';
        },

        async guardarNombre(li, a, input) {
            const nuevoNombre = input.value.trim();
            if (!nuevoNombre || nuevoNombre === a.nombre) {
                const span = li.querySelector('.pf-file-name');
                const btn  = li.querySelector('.pf-btn-edit');
                this.cancelarEdicion(li, a, span, input, btn);
                return;
            }
            try {
                const res  = await fetch(`/api/usuarios/${this.cedula}/archivos/${encodeURIComponent(a.public_id)}`, {
                    method: 'PUT',
                    headers: {'Content-Type':'application/json'},
                    body: JSON.stringify({ nombre: nuevoNombre }),
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Error');
                a.nombre = nuevoNombre;
                mostrarAlerta('Nombre actualizado');
                this.render();
            } catch(err) {
                mostrarAlerta(err.message || 'Error al renombrar', true);
            }
        },

        async cargar() {
            if (!this.cedula) return;
            try {
                const res  = await fetch(`/api/usuarios/${this.cedula}/archivos`);
                if (!res.ok) throw new Error();
                const data = await res.json();
                this.archivos = data.archivos || [];
                this.render();
            } catch {
                const loading = this.el('archivosLoading');
                const empty   = this.el('archivosEmpty');
                if (loading) loading.style.display = 'none';
                if (empty)   empty.style.display   = 'flex';
            }
        },

        async subir(files) {
            if (!files || !files.length) return;
            if (this.totalBytes() >= this.LIMITE) {
                mostrarAlerta('Has alcanzado el límite de 100 MB. Elimina archivos primero.', true);
                return;
            }
            const up   = this.el('pfUploading');
            const txt  = this.el('pfUploadingText');
            const bar  = this.el('pfProgressBar');
            const lbl  = this.el('pfUploadLabel');
            if (up)  up.style.display  = 'flex';
            if (lbl) lbl.style.pointerEvents = 'none';

            const total = files.length;
            let   done  = 0;
            for (const file of Array.from(files)) {
                if (txt) txt.textContent = `Subiendo ${file.name} (${done+1}/${total})...`;
                if (bar) bar.style.width = Math.round((done/total)*100) + '%';
                const fd = new FormData();
                fd.append('archivo', file);
                try {
                    const res  = await fetch(`/api/usuarios/${this.cedula}/archivos`, {method:'POST', body:fd});
                    const data = await res.json();
                    if (data.ok) { this.archivos.push(data.archivo); done++; }
                    else mostrarAlerta(`No se pudo subir ${file.name}: ${data.error||''}`, true);
                } catch { mostrarAlerta(`Error de conexión subiendo ${file.name}`, true); }
            }

            if (bar) bar.style.width = '100%';
            setTimeout(() => {
                if (up)  up.style.display  = 'none';
                if (bar) bar.style.width = '0%';
                if (lbl) lbl.style.pointerEvents = '';
            }, 300);

            if (done) { mostrarAlerta(`${done} archivo${done!==1?'s':''} subido${done!==1?'s':''}`); this.render(); }
        },

        async eliminar(publicId) {
            try {
                const res  = await fetch(`/api/usuarios/${this.cedula}/archivos/${encodeURIComponent(publicId)}`, {method:'DELETE'});
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || 'Error');
                this.archivos = this.archivos.filter(a => a.public_id !== publicId);
                mostrarAlerta('Archivo eliminado');
                this.render();
            } catch(err) {
                mostrarAlerta(err.message || 'Error al eliminar', true);
            }
        },

        initDrop() {
            const zone = this.el('pfDropZone');
            if (!zone) return;
            ['dragenter','dragover'].forEach(ev => {
                zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('pf-drop-active'); });
            });
            zone.addEventListener('dragleave', e => {
                if (!zone.contains(e.relatedTarget)) zone.classList.remove('pf-drop-active');
            });
            zone.addEventListener('drop', async e => {
                e.preventDefault();
                zone.classList.remove('pf-drop-active');
                await this.subir(e.dataTransfer.files);
            });
        },
    };

    window.pfSubirArchivos = async function() {
        const input = document.getElementById('pfFileInput');
        if (!input || !input.files.length) return;
        await _pf.subir(input.files);
        input.value = '';
    };

    document.addEventListener('DOMContentLoaded', () => {
        _pf.initDrop();
        _pf.cargar();
    });
})();
