
// ── State ────────────────────────────────────────────────────────────────────
let currentTab = 'cards';

// Cards state
let team1Name = "Team 1", team2Name = "Team 2";
let rounds = [], cardsSavedTeams = [];
let globalSideTrackerRegistry = {}, currentSideScores = { t1Main: 0, t1Sub: 0, t2Main: 0, t2Sub: 0 };
let globalRoundsWonRegistry = {}, showAllLeaderboard = false;
let roundTypes = [], defaultRoundTypeIndex = 0;
let matchHistory = [], showAllHistory = false;

// Domino state
let dominoTeam1Name = "Team 1", dominoTeam2Name = "Team 2";
let dominoRounds = [];
let dominoSavedTeams = [];
let dominoGlobalSideTrackerRegistry = {}, dominoCurrentSideScores = { t1Main: 0, t1Sub: 0, t2Main: 0, t2Sub: 0 };
let dominoGlobalRoundsWonRegistry = {}, dominoShowAllLeaderboard = false;
let dominoMatchHistory = [], dominoShowAllHistory = false;
let dominoTarget = 151;

// Inline editing state
let cardsEditingRound = null;
let dominoEditingRound = null;

// Sub-score rollover thresholds (how many sub scores = +1 main)
let cardsSubRollover = 10;
let dominoSubRollover = 10;

// ── UI Initialization ────────────────────────────────────────────────────────
function initializeUI() {
    const lbBtn = document.getElementById('leaderboard-toggle-btn');
    if (lbBtn) { const span = lbBtn.querySelector('span'); if (span) span.textContent = showAllLeaderboard ? 'Show Top 1' : 'Show All'; }
    const dlbBtn = document.getElementById('domino-leaderboard-toggle-btn');
    if (dlbBtn) { const span = dlbBtn.querySelector('span'); if (span) span.textContent = dominoShowAllLeaderboard ? 'Show Top 1' : 'Show All'; }
    updateTeamsUI();
    renderRoundTypes();
    renderRoundTypeRadios();
    calculateAndRenderLeaderboard();
    updateLoserInputForCurrentRoundType();
    renderMatchHistory();
    updateWinnerButtons();
    calculateAndRenderDominoLeaderboard();
    renderDominoMatchHistory();
    updateDominoWinnerButtons();
    renderCardsSubRolloverSetup();
    renderDominoSubRolloverSetup();
}


// ── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.getElementById('cards-content').classList.toggle('active-tab', tab === 'cards');
    document.getElementById('domino-content').classList.toggle('active-tab', tab === 'domino');

    // Update the game title badge
    const badge = document.getElementById('game-title-badge');
    if (badge) {
        badge.textContent = tab === 'cards' ? '♠️ Cards' : '🁺 Domino';
    }

}

// ── Theme ────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
    const isDark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    document.getElementById('theme-icon').textContent = isDark ? '☀️' : '🌙';
    document.getElementById('theme-label').textContent = isDark ? 'Light' : 'Dark';
}
function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem('cardGame_theme', next);
    applyTheme(next);
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info', actions = []) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const msg = document.createElement('div');
    msg.textContent = message;
    toast.appendChild(msg);
    if (actions.length) {
        const btnRow = document.createElement('div');
        btnRow.className = 'toast-actions';
        actions.forEach(a => {
            const btn = document.createElement('button');
            btn.className = 'toast-btn';
            btn.textContent = a.label;
            btn.onclick = () => { a.action(); toast.remove(); };
            btnRow.appendChild(btn);
        });
        toast.appendChild(btnRow);
        toast.style.animation = 'toast-in 0.3s ease, toast-out 0.4s ease 4.6s forwards';
    }
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, actions.length ? 5000 : 3000);
}

// ── Haptics ───────────────────────────────────────────────────────────────────
function haptic(ms = 15) {
    if (navigator.vibrate) navigator.vibrate(ms);
}

// ── Round Types (Cards only) ──────────────────────────────────────────────────
function loadRoundTypes() {
    try {
        const stored = localStorage.getItem('cardGame_roundTypes');
        if (stored) {
            const data = JSON.parse(stored);
            roundTypes = data.types; defaultRoundTypeIndex = data.defaultIndex || 0;
            roundTypes = roundTypes.map(rt => {
                if (rt.value !== undefined && rt.winnerPts === undefined) {
                    return { name: rt.name, winnerPts: rt.value, loserPts: null };
                }
                return { name: rt.name, winnerPts: rt.winnerPts, loserPts: rt.loserPts ?? null };
            });
        } else {
            roundTypes = [
                { name: 'Normal', winnerPts: -25, loserPts: null },
                { name: 'Double', winnerPts: -50, loserPts: 200 }
            ];
            defaultRoundTypeIndex = 0;
            saveRoundTypes();
        }
    } catch (e) {
        roundTypes = [
            { name: 'Normal', winnerPts: -25, loserPts: null },
            { name: 'Double', winnerPts: -50, loserPts: 200 }
        ];
        defaultRoundTypeIndex = 0;
    }
}
function saveRoundTypes() {
    localStorage.setItem('cardGame_roundTypes', JSON.stringify({ types: roundTypes, defaultIndex: defaultRoundTypeIndex }));
}
function getRTName(rt) { return rt.name; }

function renderRoundTypes() {
    const list = document.getElementById('rt-list');
    if (!list) return;
    list.innerHTML = '';
    if (roundTypes.length === 0) {
        list.innerHTML = `<div style="color:var(--text-muted);font-size:13px;text-align:center;padding:8px;">No teams saved</div>`;
        return;
    }
    roundTypes.forEach((rt, i) => {
        const div = document.createElement('div');
        div.className = 'rt-item';
        const loserBadge = rt.loserPts !== null && rt.loserPts !== undefined
            ? `<span class="rt-badge loser">L: ${rt.loserPts}</span>` : '';
        const defaultEl = i === defaultRoundTypeIndex
            ? `<span class="rt-default-badge">Default</span>`
            : `<button class="rt-btn set-default" onclick="setDefaultRoundType(${i})">Default</button>`;
        div.innerHTML = `
            <span class="rt-item-label">${getRTName(rt)}</span>
            <div class="rt-badges">
                <span class="rt-badge winner">W: ${rt.winnerPts}</span>
                ${loserBadge}
                ${defaultEl}
            </div>
            <div class="rt-item-actions">
                <button class="rt-btn danger" onclick="deleteRoundType(${i})" title="Remove">🗑</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function addRoundType() {
    const nameEl = document.getElementById('rt-name-input');
    const winEl = document.getElementById('rt-winner-pts-input');
    const losEl = document.getElementById('rt-loser-pts-input');

    const name = nameEl.value.trim();
    const winnerPts = parseInt(winEl.value, 10);
    const loserRaw = losEl.value.trim();
    const loserPts = loserRaw === '' ? null : parseInt(loserRaw, 10);

    if (!name) { showToast('Please enter a name.', 'error'); return; }
    if (isNaN(winnerPts) || winnerPts >= 0) { showToast('Please enter a negative winner points value (e.g. -25).', 'error'); return; }
    if (loserPts !== null && (isNaN(loserPts) || loserPts < 2)) { showToast('Loser points must be at least 2 if set.', 'error'); return; }
    if (roundTypes.some(r => r.name.toLowerCase() === name.toLowerCase())) { showToast('A round type with this name already exists.', 'error'); return; }

    roundTypes.push({ name, winnerPts, loserPts });
    saveRoundTypes();
    nameEl.value = ''; winEl.value = ''; losEl.value = '';
    renderRoundTypes(); renderRoundTypeRadios();
    showToast('Round type added!', 'success');
}

function deleteRoundType(index) {
    if (roundTypes.length <= 1) { showToast('Cannot delete the last round type.', 'error'); return; }
    roundTypes.splice(index, 1);
    if (defaultRoundTypeIndex >= roundTypes.length) defaultRoundTypeIndex = 0;
    saveRoundTypes(); renderRoundTypes(); renderRoundTypeRadios();
    showToast('Round type deleted.', 'info');
}

function setDefaultRoundType(index) {
    defaultRoundTypeIndex = index; saveRoundTypes(); renderRoundTypes(); renderRoundTypeRadios();
}

function renderRoundTypeRadios() {
    const container = document.getElementById('round-type-radios');
    if (!container) return;
    container.innerHTML = '';
    roundTypes.forEach((rt, i) => {
        const label = document.createElement('label');
        label.className = 'radio-label';
        label.innerHTML = `
            <input type="radio" name="rt-selector" value="${i}" ${i === defaultRoundTypeIndex ? 'checked' : ''}
                   onchange="handleRoundTypeChange(this)">
            ${getRTName(rt)}
        `;
        container.appendChild(label);
    });
    updateLoserInputForCurrentRoundType();
}

function handleRoundTypeChange(radioEl) {
    updateLoserInputForCurrentRoundType(parseInt(radioEl.value, 10));
}

function updateLoserInputForCurrentRoundType(idx) {
    const loserInput = document.getElementById('loser-points');
    if (!loserInput) return;
    const checkedRadio = document.querySelector('input[name="rt-selector"]:checked');
    const rtIdx = idx !== undefined ? idx : (checkedRadio ? parseInt(checkedRadio.value, 10) : defaultRoundTypeIndex);
    const rt = roundTypes[rtIdx];
    if (!rt) return;
    if (rt.loserPts !== null && rt.loserPts !== undefined) {
        loserInput.value = rt.loserPts;
        loserInput.disabled = true;
        loserInput.placeholder = `Fixed loser points: ${rt.loserPts}`;
    } else {
        loserInput.value = '';
        loserInput.disabled = false;
        loserInput.placeholder = 'Min. 2 pts';
    }
}

// ── Teams (Shared) ────────────────────────────────────────────────────────────
function migrateTeamsIfNeeded() {
    const old = localStorage.getItem('cardGame_savedTeams');
    if (old) {
        if (!localStorage.getItem('cardGame_cardsSavedTeams')) {
            localStorage.setItem('cardGame_cardsSavedTeams', old);
        }
        if (!localStorage.getItem('cardGame_dominoSavedTeams')) {
            localStorage.setItem('cardGame_dominoSavedTeams', old);
        }
        localStorage.removeItem('cardGame_savedTeams');
    }
}

function loadCardsTeams() {
    try {
        const stored = localStorage.getItem('cardGame_cardsSavedTeams');
        if (stored) { cardsSavedTeams = JSON.parse(stored); }
        else { cardsSavedTeams = ["Alpha", "Bravo", "Charlie"]; localStorage.setItem('cardGame_cardsSavedTeams', JSON.stringify(cardsSavedTeams)); }
    } catch (e) { cardsSavedTeams = ["Alpha", "Bravo", "Charlie"]; }
}

function loadDominoTeams() {
    try {
        const stored = localStorage.getItem('cardGame_dominoSavedTeams');
        if (stored) { dominoSavedTeams = JSON.parse(stored); }
        else { dominoSavedTeams = ["Alpha", "Bravo", "Charlie"]; localStorage.setItem('cardGame_dominoSavedTeams', JSON.stringify(dominoSavedTeams)); }
    } catch (e) { dominoSavedTeams = ["Alpha", "Bravo", "Charlie"]; }
}

let activeEditingTeam = { gameType: null, index: null };

function updateTeamsUI() {
    const c1 = document.getElementById('cards-team1-select');
    const c2 = document.getElementById('cards-team2-select');
    const d1 = document.getElementById('domino-team1-select');
    const d2 = document.getElementById('domino-team2-select');

    if (c1 && !cardsSavedTeams.includes(c1.value)) c1.value = '';
    if (c2 && !cardsSavedTeams.includes(c2.value)) c2.value = '';
    if (d1 && !dominoSavedTeams.includes(d1.value)) d1.value = '';
    if (d2 && !dominoSavedTeams.includes(d2.value)) d2.value = '';

    updateSlotsUI('cards');
    updateSlotsUI('domino');
}

function updateSlotsUI(gameType) {
    const t1 = document.getElementById(`${gameType}-team1-select`).value;
    const t2 = document.getElementById(`${gameType}-team2-select`).value;

    const slot1 = document.getElementById(`${gameType}-slot-t1`);
    const slot2 = document.getElementById(`${gameType}-slot-t2`);

    if (slot1) {
        if (t1) {
            slot1.className = 'team-slot-card assigned slot-t1';
            slot1.innerHTML = `
                        <div class="team-slot-badge">Team 1</div>
                        <div class="team-slot-name">${t1}</div>
                        <div class="team-slot-clear" onclick="event.stopPropagation(); unassignTeam(1, '${gameType}')" title="Clear Team 1">✕</div>
                    `;
        } else {
            slot1.className = 'team-slot-card';
            slot1.innerHTML = `
                        <div class="team-slot-placeholder">
                            <span>➕</span>
                            <div>Assign Team 1</div>
                        </div>
                    `;
        }
    }

    if (slot2) {
        if (t2) {
            slot2.className = 'team-slot-card assigned slot-t2';
            slot2.innerHTML = `
                        <div class="team-slot-badge">Team 2</div>
                        <div class="team-slot-name">${t2}</div>
                        <div class="team-slot-clear" onclick="event.stopPropagation(); unassignTeam(2, '${gameType}')" title="Clear Team 2">✕</div>
                    `;
        } else {
            slot2.className = 'team-slot-card';
            slot2.innerHTML = `
                        <div class="team-slot-placeholder">
                            <span>➕</span>
                            <div>Assign Team 2</div>
                        </div>
                    `;
        }
    }

    const containerId = gameType === 'cards' ? 'team-manager-list' : 'domino-team-manager-list';
    const container = document.getElementById(containerId);
    const teamList = gameType === 'cards' ? cardsSavedTeams : dominoSavedTeams;
    if (container) {
        renderTeamManagerList(container, teamList, gameType);
    }
}

function unassignTeam(slotNum, gameType) {
    const input = document.getElementById(`${gameType}-team${slotNum}-select`);
    if (input) {
        input.value = '';
        if (gameType === 'cards') handleCardsTeamSelectionChange();
        else handleDominoTeamSelectionChange();
    }
    haptic(10);
}

function focusCardsSlot(slotNum) {
    showToast(`Click a team card from "Saved Teams" below to assign to Team ${slotNum}!`, 'info');
    haptic(10);
}

function focusDominoSlot(slotNum) {
    showToast(`Click a team card from "Saved Teams" below to assign to Team ${slotNum}!`, 'info');
    haptic(10);
}

function handleTeamCardClick(teamName, gameType) {
    const t1Input = document.getElementById(`${gameType}-team1-select`);
    const t2Input = document.getElementById(`${gameType}-team2-select`);
    if (!t1Input || !t2Input) return;

    const t1 = t1Input.value;
    const t2 = t2Input.value;

    if (t1 === teamName) {
        unassignTeam(1, gameType);
    } else if (t2 === teamName) {
        unassignTeam(2, gameType);
    } else {
        if (!t1) {
            t1Input.value = teamName;
            if (gameType === 'cards') handleCardsTeamSelectionChange();
            else handleDominoTeamSelectionChange();
            haptic(15);
        } else if (!t2) {
            t2Input.value = teamName;
            if (gameType === 'cards') handleCardsTeamSelectionChange();
            else handleDominoTeamSelectionChange();
            haptic(15);
        } else {
            showToast("Both team slots are occupied. Clear a slot first.", "info");
        }
    }
}

function renderTeamManagerList(container, teamList, gameType) {
    container.innerHTML = '';
    if (!teamList.length) {
        container.innerHTML = `
                    <div class="tm-empty-state" style="grid-column: 1 / -1; width: 100%;">
                        <div class="empty-icon">👥</div>
                        <div class="empty-title">No teams saved</div>
                        <div class="empty-subtitle">Add teams above to get started</div>
                    </div>
                `;
        return;
    }

    const t1 = document.getElementById(`${gameType}-team1-select`).value;
    const t2 = document.getElementById(`${gameType}-team2-select`).value;

    teamList.forEach((team, i) => {
        const isSelectedT1 = (t1 === team);
        const isSelectedT2 = (t2 === team);
        const isEditing = (activeEditingTeam.gameType === gameType && activeEditingTeam.index === i);

        let selClass = '';
        if (isSelectedT1) selClass = 'selected-t1';
        else if (isSelectedT2) selClass = 'selected-t2';

        let badgeHtml = '';
        if (isSelectedT1) badgeHtml = `<div class="team-card-badge badge-t1">Team 1</div>`;
        else if (isSelectedT2) badgeHtml = `<div class="team-card-badge badge-t2">Team 2</div>`;

        const card = document.createElement('div');
        card.className = `team-manager-card ${selClass} ${isEditing ? 'card-editing' : ''}`;

        card.onclick = () => {
            if (!isEditing) {
                handleTeamCardClick(team, gameType);
            }
        };

        let nameContent = '';
        let actionBtnHtml = '';

        if (isEditing) {
            nameContent = `<input type="text" class="team-card-name-input" id="${gameType}-team-input-${i}" value="${team}" data-original="${team}" onclick="event.stopPropagation()" onkeydown="if(event.key==='Enter'){event.stopPropagation(); saveEditTeamName(${i}, '${gameType}');}else if(event.key==='Escape'){event.stopPropagation(); cancelEditTeamName(${i}, '${gameType}');}">`;
            actionBtnHtml = `<button class="team-card-btn btn-save" onclick="event.stopPropagation(); saveEditTeamName(${i}, '${gameType}')" title="Save">✓</button>`;
        } else {
            nameContent = `<div class="team-card-name" title="${team}">${team}</div>`;
            actionBtnHtml = `<button class="team-card-btn btn-edit" onclick="event.stopPropagation(); startEditTeamName(${i}, '${gameType}')" title="Edit name">✎</button>`;
        }

        card.innerHTML = `
                    ${badgeHtml}
                    ${nameContent}
                    <div class="team-card-actions">
                        ${actionBtnHtml}
                        <button class="team-card-btn btn-delete" onclick="event.stopPropagation(); removeSavedTeam(${i}, '${gameType}')" title="Remove">🗑</button>
                    </div>
                `;
        container.appendChild(card);
    });
}

function handleCardsTeamSelectionChange() {
    const v1 = document.getElementById('cards-team1-select').value;
    const v2 = document.getElementById('cards-team2-select').value;
    if (v1 && v1 === v2) {
        showToast('Please choose different teams.', 'error');
        document.getElementById('cards-team2-select').value = '';
    }
    updateSlotsUI('cards');
}

function handleDominoTeamSelectionChange() {
    const v1 = document.getElementById('domino-team1-select').value;
    const v2 = document.getElementById('domino-team2-select').value;
    if (v1 && v1 === v2) {
        showToast('Please choose different teams.', 'error');
        document.getElementById('domino-team2-select').value = '';
    }
    updateSlotsUI('domino');
}

function handleAddNewTeam() {
    const el = document.getElementById('new-team-name');
    const name = el.value.trim();
    if (!name) { showToast('Please enter a name.', 'error'); return; }
    if (cardsSavedTeams.some(t2 => t2.toLowerCase() === name.toLowerCase())) { showToast('A team with this name already exists.', 'error'); return; }
    cardsSavedTeams.push(name); localStorage.setItem('cardGame_cardsSavedTeams', JSON.stringify(cardsSavedTeams));
    el.value = ''; updateTeamsUI(); calculateAndRenderLeaderboard();
    showToast(`"${name}" — Team added!`, 'success');
}

function handleAddNewTeamDomino() {
    const el = document.getElementById('domino-new-team-name');
    const name = el.value.trim();
    if (!name) { showToast('Please enter a name.', 'error'); return; }
    if (dominoSavedTeams.some(t2 => t2.toLowerCase() === name.toLowerCase())) { showToast('A team with this name already exists.', 'error'); return; }
    dominoSavedTeams.push(name); localStorage.setItem('cardGame_dominoSavedTeams', JSON.stringify(dominoSavedTeams));
    el.value = ''; updateTeamsUI(); calculateAndRenderDominoLeaderboard();
    showToast(`"${name}" — Team added!`, 'success');
}

function startEditTeamName(index, gameType) {
    activeEditingTeam = { gameType, index };
    updateTeamsUI();
    setTimeout(() => {
        const input = document.getElementById(`${gameType}-team-input-${index}`);
        if (input) {
            input.focus();
            input.select();
        }
    }, 50);
}

function cancelEditTeamName(index, gameType) {
    activeEditingTeam = { gameType: null, index: null };
    updateTeamsUI();
}

function saveEditTeamName(index, gameType) {
    const input = document.getElementById(`${gameType}-team-input-${index}`);
    if (!input) return;
    const oldName = input.getAttribute('data-original');
    const newName = input.value.trim();
    if (!newName || newName === oldName) { cancelEditTeamName(index, gameType); return; }
    const teamList = gameType === 'cards' ? cardsSavedTeams : dominoSavedTeams;
    if (teamList.some((t, i) => i !== index && t.toLowerCase() === newName.toLowerCase())) {
        showToast('A team with this name already exists.', 'error');
        cancelEditTeamName(index, gameType);
        return;
    }
    teamList[index] = newName;
    localStorage.setItem(`cardGame_${gameType}SavedTeams`, JSON.stringify(teamList));

    if (gameType === 'cards') {
        if (globalRoundsWonRegistry[oldName] !== undefined) {
            globalRoundsWonRegistry[newName] = globalRoundsWonRegistry[oldName];
            delete globalRoundsWonRegistry[oldName];
            localStorage.setItem('cardGame_globalRoundsRegistry', JSON.stringify(globalRoundsWonRegistry));
        }
        const reg = localStorage.getItem('cardGame_globalSideRegistry');
        if (reg) {
            let tmp = JSON.parse(reg);
            const newTmp = {};
            Object.keys(tmp).forEach(k => {
                const p = k.split('|||');
                let newK = k;
                let newD = { ...tmp[k] };
                if (p[0] === oldName) {
                    const sorted = [newName, p[1]].sort();
                    newK = sorted.join('|||');
                    if (sorted[0] === newName) {
                        newD = { t1Main: tmp[k].t1Main, t1Sub: tmp[k].t1Sub, t2Main: tmp[k].t2Main, t2Sub: tmp[k].t2Sub };
                    } else {
                        newD = { t1Main: tmp[k].t2Main, t1Sub: tmp[k].t2Sub, t2Main: tmp[k].t1Main, t2Sub: tmp[k].t1Sub };
                    }
                } else if (p[1] === oldName) {
                    const sorted = [p[0], newName].sort();
                    newK = sorted.join('|||');
                    if (sorted[0] === p[0]) {
                        newD = { t1Main: tmp[k].t1Main, t1Sub: tmp[k].t1Sub, t2Main: tmp[k].t2Main, t2Sub: tmp[k].t2Sub };
                    } else {
                        newD = { t1Main: tmp[k].t2Main, t1Sub: tmp[k].t2Sub, t2Main: tmp[k].t1Main, t2Sub: tmp[k].t1Sub };
                    }
                }
                newTmp[newK] = newD;
            });
            globalSideTrackerRegistry = newTmp;
            localStorage.setItem('cardGame_globalSideRegistry', JSON.stringify(newTmp));
        }
        const hist = localStorage.getItem('cardGame_matchHistory');
        if (hist) {
            let h = JSON.parse(hist);
            h.forEach(m => {
                if (m.team1 === oldName) m.team1 = newName;
                if (m.team2 === oldName) m.team2 = newName;
                if (m.winner === oldName) m.winner = newName;
                m.rounds.forEach(r => { if (r.winnerTeam === oldName) r.winnerTeam = newName; });
            });
            matchHistory = h;
            localStorage.setItem('cardGame_matchHistory', JSON.stringify(h));
        }
        const ag = localStorage.getItem('cardGame_activeGame');
        if (ag) {
            const gd = JSON.parse(ag);
            if (gd.t1Name === oldName) gd.t1Name = newName;
            if (gd.t2Name === oldName) gd.t2Name = newName;
            gd.rounds.forEach(r => { if (r.winnerTeam === oldName) r.winnerTeam = newName; });
            localStorage.setItem('cardGame_activeGame', JSON.stringify(gd));
            if (team1Name === oldName) team1Name = newName;
            if (team2Name === oldName) team2Name = newName;
        }
    } else {
        if (dominoGlobalRoundsWonRegistry[oldName] !== undefined) {
            dominoGlobalRoundsWonRegistry[newName] = dominoGlobalRoundsWonRegistry[oldName];
            delete dominoGlobalRoundsWonRegistry[oldName];
            localStorage.setItem('cardGame_domino_globalRoundsRegistry', JSON.stringify(dominoGlobalRoundsWonRegistry));
        }
        const dreg = localStorage.getItem('cardGame_domino_globalSideRegistry');
        if (dreg) {
            let tmp = JSON.parse(dreg);
            const newTmp = {};
            Object.keys(tmp).forEach(k => {
                const p = k.split('|||');
                let newK = k;
                let newD = { ...tmp[k] };
                if (p[0] === oldName) {
                    const sorted = [newName, p[1]].sort();
                    newK = sorted.join('|||');
                    if (sorted[0] === newName) {
                        newD = { t1Main: tmp[k].t1Main, t1Sub: tmp[k].t1Sub, t2Main: tmp[k].t2Main, t2Sub: tmp[k].t2Sub };
                    } else {
                        newD = { t1Main: tmp[k].t2Main, t1Sub: tmp[k].t2Sub, t2Main: tmp[k].t1Main, t2Sub: tmp[k].t1Sub };
                    }
                } else if (p[1] === oldName) {
                    const sorted = [p[0], newName].sort();
                    newK = sorted.join('|||');
                    if (sorted[0] === p[0]) {
                        newD = { t1Main: tmp[k].t1Main, t1Sub: tmp[k].t1Sub, t2Main: tmp[k].t2Main, t2Sub: tmp[k].t2Sub };
                    } else {
                        newD = { t1Main: tmp[k].t2Main, t1Sub: tmp[k].t2Sub, t2Main: tmp[k].t1Main, t2Sub: tmp[k].t1Sub };
                    }
                }
                newTmp[newK] = newD;
            });
            dominoGlobalSideTrackerRegistry = newTmp;
            localStorage.setItem('cardGame_domino_globalSideRegistry', JSON.stringify(newTmp));
        }
        const dhist = localStorage.getItem('cardGame_domino_matchHistory');
        if (dhist) {
            let h = JSON.parse(dhist);
            h.forEach(m => {
                if (m.team1 === oldName) m.team1 = newName;
                if (m.team2 === oldName) m.team2 = newName;
                if (m.winner === oldName) m.winner = newName;
                m.rounds.forEach(r => { if (r.winnerTeam === oldName) r.winnerTeam = newName; });
            });
            dominoMatchHistory = h;
            localStorage.setItem('cardGame_domino_matchHistory', JSON.stringify(h));
        }
        const dag = localStorage.getItem('cardGame_domino_activeGame');
        if (dag) {
            const gd = JSON.parse(dag);
            if (gd.t1Name === oldName) gd.t1Name = newName;
            if (gd.t2Name === oldName) gd.t2Name = newName;
            gd.rounds.forEach(r => { if (r.winnerTeam === oldName) r.winnerTeam = newName; });
            localStorage.setItem('cardGame_domino_activeGame', JSON.stringify(gd));
            if (dominoTeam1Name === oldName) dominoTeam1Name = newName;
            if (dominoTeam2Name === oldName) dominoTeam2Name = newName;
        }
    }

    activeEditingTeam = { gameType: null, index: null };
    updateTeamsUI();
    if (gameType === 'cards') {
        calculateAndRenderLeaderboard();
        renderMatchHistory();
    } else {
        calculateAndRenderDominoLeaderboard();
        renderDominoMatchHistory();
    }
    showToast(`"${oldName}" renamed to "${newName}"`, 'success');
}

function removeSavedTeam(index, gameType) {
    const teamList = gameType === 'cards' ? cardsSavedTeams : dominoSavedTeams;
    const rem = teamList[index];
    if (!confirm('Remove this team? All tracking history will be deleted.')) return;
    teamList.splice(index, 1);
    localStorage.setItem(`cardGame_${gameType}SavedTeams`, JSON.stringify(teamList));

    if (gameType === 'cards') {
        if (globalRoundsWonRegistry[rem] !== undefined) {
            delete globalRoundsWonRegistry[rem];
            localStorage.setItem('cardGame_globalRoundsRegistry', JSON.stringify(globalRoundsWonRegistry));
        }
        const reg = localStorage.getItem('cardGame_globalSideRegistry');
        if (reg) {
            let tmp = JSON.parse(reg);
            Object.keys(tmp).forEach(k => { const p = k.split('|||'); if (p[0] === rem || p[1] === rem) delete tmp[k]; });
            globalSideTrackerRegistry = tmp;
            localStorage.setItem('cardGame_globalSideRegistry', JSON.stringify(tmp));
        }
        const ag = localStorage.getItem('cardGame_activeGame');
        if (ag) {
            const gd = JSON.parse(ag);
            if (gd.t1Name === rem || gd.t2Name === rem) {
                localStorage.removeItem('cardGame_activeGame');
                rounds = [];
                if (currentTab === 'cards') showCardsSetup();
            }
        }
    } else {
        if (dominoGlobalRoundsWonRegistry[rem] !== undefined) {
            delete dominoGlobalRoundsWonRegistry[rem];
            localStorage.setItem('cardGame_domino_globalRoundsRegistry', JSON.stringify(dominoGlobalRoundsWonRegistry));
        }
        const dreg = localStorage.getItem('cardGame_domino_globalSideRegistry');
        if (dreg) {
            let tmp = JSON.parse(dreg);
            Object.keys(tmp).forEach(k => { const p = k.split('|||'); if (p[0] === rem || p[1] === rem) delete tmp[k]; });
            dominoGlobalSideTrackerRegistry = tmp;
            localStorage.setItem('cardGame_domino_globalSideRegistry', JSON.stringify(tmp));
        }
        const dag = localStorage.getItem('cardGame_domino_activeGame');
        if (dag) {
            const gd = JSON.parse(dag);
            if (gd.t1Name === rem || gd.t2Name === rem) {
                localStorage.removeItem('cardGame_domino_activeGame');
                dominoRounds = [];
                if (currentTab === 'domino') showDominoSetup();
            }
        }
    }
    updateTeamsUI();
    if (gameType === 'cards') calculateAndRenderLeaderboard();
    else calculateAndRenderDominoLeaderboard();
}

// ── Cards Match History ────────────────────────────────────────────────────
function loadMatchHistory() {
    try {
        const stored = localStorage.getItem('cardGame_matchHistory');
        if (stored) matchHistory = JSON.parse(stored);
        else matchHistory = [];
    } catch (e) { matchHistory = []; }
    renderMatchHistory();
}

function saveMatchHistory() {
    localStorage.setItem('cardGame_matchHistory', JSON.stringify(matchHistory));
    renderMatchHistory();
}

function archiveMatch(winnerName) {
    let t1T = 0, t2T = 0;
    rounds.forEach(r => { t1T += r.t1; t2T += r.t2; });
    matchHistory.unshift({
        date: new Date().toISOString(),
        team1: team1Name, team2: team2Name,
        winner: winnerName,
        t1Total: t1T, t2Total: t2T,
        roundCount: rounds.length,
        rounds: JSON.parse(JSON.stringify(rounds))
    });
    if (matchHistory.length > 50) matchHistory.pop();
    saveMatchHistory();
}

function renderMatchHistory() {
    const card = document.getElementById('match-history-card');
    const list = document.getElementById('match-history-list');
    const toggleBtn = document.getElementById('history-toggle-btn');
    if (!card || !list) return;
    if (!matchHistory.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    list.innerHTML = '';
    const display = showAllHistory ? matchHistory : matchHistory.slice(0, 3);
    if (toggleBtn) {
        const span = toggleBtn.querySelector('span');
        if (span) span.textContent = showAllHistory ? 'Show Top 3' : 'Show All';
    }
    display.forEach(m => {
        const date = new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const margin = Math.abs(m.t1Total - m.t2Total);
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-header">
                <span class="history-winner">🏆 ${m.winner}</span>
                <span class="history-date">${date}</span>
            </div>
            <div class="history-detail">
                <span class="history-scores">${m.team1} ${m.t1Total} — ${m.t2Total} ${m.team2}</span>
                <span style="color:var(--text-muted);"> · by ${margin} · ${m.roundCount} rounds</span>
            </div>
        `;
        list.appendChild(div);
    });
}

function toggleMatchHistory() {
    showAllHistory = !showAllHistory;
    renderMatchHistory();
}

function clearMatchHistory() {
    if (!confirm('Clear all match history?')) return;
    matchHistory = [];
    localStorage.removeItem('cardGame_matchHistory');
    renderMatchHistory();
}

// ── Cards Game ──────────────────────────────────────────────────────────────
function showCardsSetup() {
    document.getElementById('cards-game-section').style.display = 'none';
    document.getElementById('cards-setup-section').style.display = 'block';
    document.getElementById('layout-wrapper').classList.remove('with-sidebar');
    document.getElementById('game-tabs').classList.remove('hidden');
    document.getElementById('cards-team-management').style.display = 'block';
    removeSidebar();
    const badge = document.getElementById('game-title-badge');
    if (badge) { badge.style.display = 'none'; }
    const resetBtn = document.getElementById('cards-reset-btn-top');
    if (resetBtn) resetBtn.style.display = 'none';
    const ieContainer = document.getElementById('import-export-container');
    if (ieContainer) ieContainer.style.display = 'flex';
}

function loadCardsActiveGame() {
    try {
        const ag = localStorage.getItem('cardGame_activeGame');
        if (ag) {
            const gd = JSON.parse(ag);
            team1Name = gd.t1Name || 'Team 1';
            team2Name = gd.t2Name || 'Team 2';
            rounds = (gd.rounds || []).map(r => ({
                t1: r.t1, t2: r.t2,
                winnerPts: r.winnerPts !== undefined ? r.winnerPts : (r.t1 < 0 ? r.t1 : r.t2),
                winnerTeam: r.winnerTeam || r.winner,
                note: r.note || ''
            }));
            if (rounds.length || (team1Name !== 'Team 1' && team2Name !== 'Team 2')) {
                if (currentTab === 'cards') { injectSidebar(); setupCardsGameView(); }
            }
        }
    } catch (e) { console.error('Failed to load active game:', e); localStorage.removeItem('cardGame_activeGame'); }
}

function saveCardsGameState() {
    localStorage.setItem('cardGame_activeGame', JSON.stringify({ t1Name: team1Name, t2Name: team2Name, rounds }));
}

function startCardsGame() {
    const t1 = document.getElementById('cards-team1-select').value;
    const t2 = document.getElementById('cards-team2-select').value;
    if (!t1 || !t2) { showToast('Please select both teams.', 'error'); return; }
    if (t1 === t2) { showToast('Please choose different teams.', 'error'); return; }
    team1Name = t1; team2Name = t2; rounds = [];
    saveCardsGameState(); setupCardsGameView();
}

function setupCardsGameView() {
    document.getElementById('th-team1').innerText = team1Name;
    document.getElementById('th-team2').innerText = team2Name;
    document.getElementById('btn-winner-t1').innerText = team1Name;
    document.getElementById('btn-winner-t2').innerText = team2Name;

    document.getElementById('winner-select-hidden').value = '';
    updateWinnerButtons();
    document.getElementById('cards-setup-section').style.display = 'none';
    document.getElementById('cards-game-section').style.display = 'block';
    document.getElementById('layout-wrapper').classList.add('with-sidebar');
    document.getElementById('game-tabs').classList.add('hidden');
    document.getElementById('cards-team-management').style.display = 'none';
    const badge = document.getElementById('game-title-badge');
    if (badge) { badge.style.display = 'inline-flex'; badge.textContent = '♠️ Cards'; }
    const resetBtn = document.getElementById('cards-reset-btn-top');
    if (resetBtn) resetBtn.style.display = 'inline-flex';
    const ieContainer = document.getElementById('import-export-container');
    if (ieContainer) ieContainer.style.display = 'none';
    injectSidebar();
    renderRoundTypeRadios();
    loadTeamPairSideScores(team1Name, team2Name);
    renderTable();
}

function setWinner(val) {
    document.getElementById('winner-select-hidden').value = val;
    updateWinnerButtons();
    haptic(10);

    const loserInput = document.getElementById('loser-points');
    if (loserInput && !loserInput.disabled) {
        loserInput.focus();
        loserInput.select();
    }
}

function updateWinnerButtons() {
    const val = document.getElementById('winner-select-hidden').value;
    const b1 = document.getElementById('btn-winner-t1');
    const b2 = document.getElementById('btn-winner-t2');
    b1.classList.toggle('selected', val === '1');
    b2.classList.toggle('selected', val === '2');
}

function loadGlobalRoundsRegistry() {
    try {
        const s = localStorage.getItem('cardGame_globalRoundsRegistry');
        if (s) globalRoundsWonRegistry = JSON.parse(s);
    } catch (e) { globalRoundsWonRegistry = {}; }
}
function incrementRoundWinMetric(name) { if (!globalRoundsWonRegistry[name]) globalRoundsWonRegistry[name] = 0; globalRoundsWonRegistry[name]++; localStorage.setItem('cardGame_globalRoundsRegistry', JSON.stringify(globalRoundsWonRegistry)); }
function decrementRoundWinMetric(name) { if (globalRoundsWonRegistry[name] > 0) { globalRoundsWonRegistry[name]--; localStorage.setItem('cardGame_globalRoundsRegistry', JSON.stringify(globalRoundsWonRegistry)); } }

function addRound() {
    const winner = document.getElementById('winner-select-hidden').value;
    if (!winner) { showToast('Who won this round?', 'error'); return; }
    const loserEl = document.getElementById('loser-points');
    const checkedRadio = document.querySelector('input[name="rt-selector"]:checked');
    if (!checkedRadio) { showToast('Please enter a name.', 'error'); return; }
    const rtIdx = parseInt(checkedRadio.value, 10);
    const rt = roundTypes[rtIdx];
    const winnerPts = rt.winnerPts;

    let loserPts;
    if (rt.loserPts !== null && rt.loserPts !== undefined) {
        loserPts = rt.loserPts;
    } else {
        const raw = loserEl.value;
        if (raw === '') { showToast('Please enter the loser\'s hand points.', 'error'); return; }
        loserPts = parseInt(raw, 10);
        if (isNaN(loserPts) || loserPts < 2) { showToast('Points must be at least 2.', 'error'); return; }
    }

    const note = document.getElementById('round-note').value.trim();

    let t1Score, t2Score;
    if (winner === "1") { t1Score = winnerPts; t2Score = loserPts; incrementRoundWinMetric(team1Name); }
    else { t1Score = loserPts; t2Score = winnerPts; incrementRoundWinMetric(team2Name); }

    rounds.push({ t1: t1Score, t2: t2Score, winnerPts, winnerTeam: winner === "1" ? team1Name : team2Name, note });
    saveCardsGameState();

    const radios = document.querySelectorAll('input[name="rt-selector"]');
    if (radios[defaultRoundTypeIndex]) { radios[defaultRoundTypeIndex].checked = true; updateLoserInputForCurrentRoundType(defaultRoundTypeIndex); }
    document.getElementById('round-note').value = '';

    renderTable(true);
    showToast(`Round added! ${rounds.length}`, 'success');
    haptic(20);
}

function renderTable(flashLast = false) {
    const tbody = document.querySelector('#score-table tbody');
    tbody.innerHTML = '';
    let t1Total = 0, t2Total = 0;
    if (!rounds || !rounds.length) {
        document.getElementById('t1-total').innerText = '0';
        document.getElementById('t2-total').innerText = '0';
        document.getElementById('combined-diff-cell').className = 'status-tie';
        document.getElementById('combined-diff-cell').innerText = '-';
        document.getElementById('declare-winner-btn').disabled = true;
        updateWinProbBar(0, 0);
        return;
    }
    rounds.forEach((round, i) => {
        t1Total += round.t1; t2Total += round.t2;
        const tr = document.createElement('tr');
        const winnerPts = round.winnerPts !== undefined ? round.winnerPts : (round.t1 < 0 ? round.t1 : round.t2);

        const isT1Winner = (round.t1 === winnerPts);
        const isT2Winner = (round.t2 === winnerPts);

        if (flashLast && i === rounds.length - 1) tr.className = 'row-new';

        let noteHtml = '';
        if (round.note) {
            noteHtml = `<span class="score-row-note-indicator" onclick="event.stopPropagation(); this.parentElement.parentElement.parentElement.nextElementSibling.style.display=this.parentElement.parentElement.parentElement.nextElementSibling.style.display==='none'?'table-row':'none'" title="Show note">💬</span>`;
        }

        const isEditing = cardsEditingRound === i;
        let t1CellContent, t2CellContent, actionsContent;
        if (isEditing) {
            t1CellContent = `<input type="number" class="score-edit-input" id="edit-t1-${i}" value="${round.t1}">`;
            t2CellContent = `<input type="number" class="score-edit-input" id="edit-t2-${i}" value="${round.t2}">`;
            actionsContent = `<button class="score-save-btn" onclick="saveEditScore(${i})" title="Save">✓</button><button class="score-cancel-btn" onclick="cancelEditScore()" title="Cancel">✕</button>`;
        } else {
            const t1WrapClass = `score-val-wrap ${isT1Winner ? 'winner' : 'loser'}`;
            const t2WrapClass = `score-val-wrap ${isT2Winner ? 'winner' : 'loser'}`;
            t1CellContent = `<div style="display:flex;align-items:center;justify-content:center;position:relative;"><span class="${t1WrapClass}">${round.t1}</span>${noteHtml}</div>`;
            t2CellContent = `<div style="display:flex;align-items:center;justify-content:center;position:relative;"><span class="${t2WrapClass}">${round.t2}</span></div>`;
            actionsContent = `<button class="edit-score-btn" onclick="startEditScore(${i})" title="Edit">✎</button><button class="delete-score-btn" onclick="deleteRound(${i})" title="Delete">🗑</button>`;
        }

        const rndBadge = `<span class="rnd-badge">${i + 1}</span>`;

        tr.innerHTML = `<td>${rndBadge}</td><td data-label="${team1Name}">${t1CellContent}</td><td data-label="${team2Name}">${t2CellContent}</td><td class="actions-cell">${actionsContent}</td>`;
        tbody.appendChild(tr);

        if (round.note) {
            const noteTr = document.createElement('tr');
            noteTr.className = 'note-row';
            noteTr.style.display = 'none';
            noteTr.innerHTML = `<td colspan="4">💬 ${round.note}</td>`;
            tbody.appendChild(noteTr);
        }
    });
    document.getElementById('t1-total').innerText = t1Total;
    document.getElementById('t2-total').innerText = t2Total;
    const diffCell = document.getElementById('combined-diff-cell');

    updateWinProbBar(t1Total, t2Total);

    const diff = Math.abs(t1Total - t2Total);
    if (t1Total < t2Total) {
        diffCell.className = 'status-advantage';
        diffCell.innerText = `${team1Name} leads by ${diff}`;
    } else if (t2Total < t1Total) {
        diffCell.className = 'status-advantage';
        diffCell.innerText = `${team2Name} leads by ${diff}`;
    } else {
        diffCell.className = 'status-tie';
        diffCell.innerText = 'Scores are tied';
    }
    document.getElementById('declare-winner-btn').disabled = false;
}

// Inline score editing for Cards
function startEditScore(roundIndex) {
    cardsEditingRound = roundIndex;
    renderTable();
    // Focus on first input
    setTimeout(() => {
        const input = document.getElementById(`edit-t1-${roundIndex}`);
        if (input) { input.focus(); input.select(); }
    }, 50);
}

function saveEditScore(roundIndex) {
    const t1Input = document.getElementById(`edit-t1-${roundIndex}`);
    const t2Input = document.getElementById(`edit-t2-${roundIndex}`);
    if (!t1Input || !t2Input) return;

    const newT1 = parseInt(t1Input.value, 10);
    const newT2 = parseInt(t2Input.value, 10);

    if (isNaN(newT1) || isNaN(newT2)) {
        showToast('Invalid score values', 'error');
        return;
    }

    // Update the round
    const oldRound = rounds[roundIndex];
    // Adjust winner metrics if winner changed
    if (oldRound.winnerTeam === team1Name && newT1 >= newT2) {
        decrementRoundWinMetric(team1Name);
        if (newT2 < newT1) incrementRoundWinMetric(team2Name);
    } else if (oldRound.winnerTeam === team2Name && newT2 >= newT1) {
        decrementRoundWinMetric(team2Name);
        if (newT1 < newT2) incrementRoundWinMetric(team1Name);
    }

    rounds[roundIndex].t1 = newT1;
    rounds[roundIndex].t2 = newT2;
    rounds[roundIndex].winnerTeam = newT1 < newT2 ? team1Name : team2Name;
    rounds[roundIndex].winnerPts = newT1 < newT2 ? newT1 : newT2;

    cardsEditingRound = null;
    saveCardsGameState();
    renderTable();
    showToast('Score updated!', 'success');
}

function cancelEditScore() {
    cardsEditingRound = null;
    renderTable();
}
function deleteRound(index) {
    if (!confirm('Delete this round?')) return;
    const round = rounds[index];
    if (round.winnerTeam === team1Name) decrementRoundWinMetric(team1Name);
    else if (round.winnerTeam === team2Name) decrementRoundWinMetric(team2Name);
    rounds.splice(index, 1);
    saveCardsGameState();
    renderTable();
    showToast('Round deleted', 'info');
}

function updateWinProbBar(t1, t2) {
    const bar = document.getElementById('win-prob-fill');
    if (!rounds.length) { bar.style.width = '50%'; return; }
    const total = Math.abs(t1) + Math.abs(t2);
    if (total === 0) { bar.style.width = '50%'; return; }
    const t1Ratio = Math.abs(t1) / total;
    const t2Ratio = Math.abs(t2) / total;
    let pct;
    if (t1 < t2) pct = 50 + (t2Ratio * 50);
    else if (t2 < t1) pct = 50 - (t1Ratio * 50);
    else pct = 50;
    bar.style.width = `${Math.max(5, Math.min(95, pct))}%`;
}

function showVictoryCelebration(winner, roundsCount, totalScore, margin) {
    document.getElementById('victory-modal-subtitle').textContent = `${winner} has won the match!`;
    document.getElementById('victory-stat-rounds').textContent = roundsCount;
    document.getElementById('victory-stat-score').textContent = totalScore;
    document.getElementById('victory-stat-margin').textContent = margin;
    document.getElementById('victory-modal').style.display = 'flex';

    // Trigger beautiful dual canvas-confetti
    try {
        const duration = 3 * 1000;
        const end = Date.now() + duration;

        (function frame() {
            confetti({
                particleCount: 4,
                angle: 60,
                spread: 55,
                origin: { x: 0, y: 0.8 }
            });
            confetti({
                particleCount: 4,
                angle: 120,
                spread: 55,
                origin: { x: 1, y: 0.8 }
            });

            if (Date.now() < end) {
                requestAnimationFrame(frame);
            }
        }());
    } catch (e) {
        console.warn('Confetti library is loading or failed:', e);
    }

    // Trigger celebratory rhythmic haptics
    haptic([100, 50, 100, 50, 200]);
}

function closeVictoryModal() {
    document.getElementById('victory-modal').style.display = 'none';
}

function declareWinner() {
    if (!rounds.length) return;
    let t1T = 0, t2T = 0; rounds.forEach(r => { t1T += r.t1; t2T += r.t2; });
    if (t1T === t2T) { showToast('It\'s tied! Play another round.', 'error'); return; }
    const winner = t1T < t2T ? team1Name : team2Name;
    const roundsCount = rounds.length;
    const totalScore = t1T < t2T ? t1T : t2T;
    const margin = Math.abs(t1T - t2T);

    adjustSideScore(t1T < t2T ? 't1Sub' : 't2Sub', 1);
    archiveMatch(winner);

    showVictoryCelebration(winner, roundsCount, totalScore, margin);

    rounds = []; saveCardsGameState(); renderTable();
}

function resetGame() {
    if (!confirm('End this game? Main table records will be deleted.')) return;
    localStorage.removeItem('cardGame_activeGame'); rounds = [];
    removeSidebar();
    showCardsSetup(); updateTeamsUI(); calculateAndRenderLeaderboard();
}

// ── Domino Match History ───────────────────────────────────────────────────
function loadDominoMatchHistory() {
    try {
        const stored = localStorage.getItem('cardGame_domino_matchHistory');
        if (stored) dominoMatchHistory = JSON.parse(stored);
        else dominoMatchHistory = [];
    } catch (e) { dominoMatchHistory = []; }
    renderDominoMatchHistory();
}

function saveDominoMatchHistory() {
    localStorage.setItem('cardGame_domino_matchHistory', JSON.stringify(dominoMatchHistory));
    renderDominoMatchHistory();
}

function archiveDominoMatch(winnerName) {
    let t1T = 0, t2T = 0;
    dominoRounds.forEach(r => { t1T += r.t1; t2T += r.t2; });
    dominoMatchHistory.unshift({
        date: new Date().toISOString(),
        team1: dominoTeam1Name, team2: dominoTeam2Name,
        winner: winnerName,
        t1Total: t1T, t2Total: t2T,
        roundCount: dominoRounds.length,
        rounds: JSON.parse(JSON.stringify(dominoRounds))
    });
    if (dominoMatchHistory.length > 50) dominoMatchHistory.pop();
    saveDominoMatchHistory();
}

function renderDominoMatchHistory() {
    const card = document.getElementById('domino-match-history-card');
    const list = document.getElementById('domino-match-history-list');
    const toggleBtn = document.getElementById('domino-history-toggle-btn');
    if (!card || !list) return;
    if (!dominoMatchHistory.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    list.innerHTML = '';
    const display = dominoShowAllHistory ? dominoMatchHistory : dominoMatchHistory.slice(0, 3);
    if (toggleBtn) {
        const span = toggleBtn.querySelector('span');
        if (span) span.textContent = dominoShowAllHistory ? 'Show Top 3' : 'Show All';
    }
    display.forEach(m => {
        const date = new Date(m.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const margin = Math.abs(m.t1Total - m.t2Total);
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="history-header">
                <span class="history-winner">🏆 ${m.winner}</span>
                <span class="history-date">${date}</span>
            </div>
            <div class="history-detail">
                <span class="history-scores">${m.team1} ${m.t1Total} — ${m.t2Total} ${m.team2}</span>
                <span style="color:var(--text-muted);"> · by ${margin} · ${m.roundCount} rounds</span>
            </div>
        `;
        list.appendChild(div);
    });
}

function toggleDominoMatchHistory() {
    dominoShowAllHistory = !dominoShowAllHistory;
    renderDominoMatchHistory();
}

function clearDominoMatchHistory() {
    if (!confirm('Clear all Domino match history?')) return;
    dominoMatchHistory = [];
    localStorage.removeItem('cardGame_domino_matchHistory');
    renderDominoMatchHistory();
}

// ── Domino Game ─────────────────────────────────────────────────────────────
function showDominoSetup() {
    document.getElementById('domino-game-section').style.display = 'none';
    document.getElementById('domino-setup-section').style.display = 'block';
    document.getElementById('layout-wrapper').classList.remove('with-sidebar');
    document.getElementById('game-tabs').classList.remove('hidden');
    document.getElementById('domino-team-management').style.display = 'block';
    removeSidebar();
    const badge = document.getElementById('game-title-badge');
    if (badge) { badge.style.display = 'none'; }
    const resetBtn = document.getElementById('domino-reset-btn-top');
    if (resetBtn) resetBtn.style.display = 'none';
    const ieContainer = document.getElementById('import-export-container');
    if (ieContainer) ieContainer.style.display = 'flex';
}

function loadDominoActiveGame() {
    try {
        const ag = localStorage.getItem('cardGame_domino_activeGame');
        if (ag) {
            const gd = JSON.parse(ag);
            dominoTeam1Name = gd.t1Name || 'Team 1';
            dominoTeam2Name = gd.t2Name || 'Team 2';
            dominoRounds = (gd.rounds || []).map(r => ({
                t1: r.t1, t2: r.t2,
                winnerTeam: r.winnerTeam,
                note: r.note || ''
            }));
            const savedTarget = parseInt(gd.target, 10);
            if (!isNaN(savedTarget) && savedTarget >= 1) dominoTarget = Math.min(savedTarget, 9999);
            if (dominoRounds.length || (dominoTeam1Name !== 'Team 1' && dominoTeam2Name !== 'Team 2')) {
                if (currentTab === 'domino') { injectDominoSidebar(); setupDominoGameView(); }
            }
        }
    } catch (e) { console.error('Failed to load domino active game:', e); localStorage.removeItem('cardGame_domino_activeGame'); }
    syncDominoTargetInput();
}

function saveDominoGameState() {
    localStorage.setItem('cardGame_domino_activeGame', JSON.stringify({
        t1Name: dominoTeam1Name, t2Name: dominoTeam2Name, rounds: dominoRounds, target: dominoTarget
    }));
}

function loadDominoTarget() {
    const v = parseInt(localStorage.getItem('cardGame_dominoTarget') || '151', 10);
    dominoTarget = (!isNaN(v) && v >= 1) ? Math.min(v, 9999) : 151;
    syncDominoTargetInput();
    updateDominoTargetPresetsUI();
}

function syncDominoTargetInput() {
    const input = document.getElementById('domino-target-input');
    if (input) input.value = dominoTarget;
}

function setDominoTargetPreset(val) {
    dominoTarget = val;
    localStorage.setItem('cardGame_dominoTarget', dominoTarget);

    const customWrapper = document.getElementById('custom-target-wrapper');
    if (customWrapper) customWrapper.style.display = 'none';

    syncDominoTargetInput();
    updateDominoTargetPresetsUI();
    haptic(15);
}

function toggleCustomDominoTarget() {
    const customWrapper = document.getElementById('custom-target-wrapper');
    if (customWrapper) {
        const isCurrentlyHidden = customWrapper.style.display === 'none';
        customWrapper.style.display = isCurrentlyHidden ? 'block' : 'none';

        if (isCurrentlyHidden) {
            setTimeout(() => {
                const input = document.getElementById('domino-target-input');
                if (input) {
                    input.focus();
                    input.select();
                }
            }, 50);
        }
    }
    updateDominoTargetPresetsUI(true);
    haptic(15);
}

function handleDominoTargetCustomInput() {
    const input = document.getElementById('domino-target-input');
    if (!input) return;
    const val = parseInt(input.value, 10);
    if (!isNaN(val) && val >= 1 && val <= 9999) {
        dominoTarget = val;
        localStorage.setItem('cardGame_dominoTarget', dominoTarget);
    }
}

function updateDominoTargetPresetsUI(forceCustomActive = false) {
    const presets = [100, 151, 200];
    presets.forEach(p => {
        const btn = document.getElementById(`preset-domino-${p}`);
        if (btn) btn.classList.remove('active');
    });
    const customBtn = document.getElementById('preset-domino-custom');
    if (customBtn) customBtn.classList.remove('active');

    if (forceCustomActive || !presets.includes(dominoTarget)) {
        if (customBtn) customBtn.classList.add('active');
        const customWrapper = document.getElementById('custom-target-wrapper');
        if (customWrapper) customWrapper.style.display = 'block';
    } else {
        const activeBtn = document.getElementById(`preset-domino-${dominoTarget}`);
        if (activeBtn) activeBtn.classList.add('active');
    }
}

function saveDominoTargetFromInput() {
    const input = document.getElementById('domino-target-input');
    if (!input) return true;
    const v = parseInt(input.value, 10);
    if (isNaN(v) || v < 1 || v > 9999) {
        showToast('Enter a valid target between 1 and 9999.', 'error');
        syncDominoTargetInput();
        return false;
    }
    dominoTarget = v;
    input.value = dominoTarget;
    localStorage.setItem('cardGame_dominoTarget', dominoTarget);
    updateDominoTargetPresetsUI();
    return true;
}

function startDominoGame() {
    const t1 = document.getElementById('domino-team1-select').value;
    const t2 = document.getElementById('domino-team2-select').value;
    if (!t1 || !t2) { showToast('Please select both teams.', 'error'); return; }
    if (t1 === t2) { showToast('Please choose different teams.', 'error'); return; }
    if (!saveDominoTargetFromInput()) return;
    dominoTeam1Name = t1; dominoTeam2Name = t2; dominoRounds = [];
    saveDominoGameState(); setupDominoGameView();
}

function setupDominoGameView() {
    document.getElementById('domino-th-team1').innerText = dominoTeam1Name;
    document.getElementById('domino-th-team2').innerText = dominoTeam2Name;
    document.getElementById('domino-btn-winner-t1').innerText = dominoTeam1Name;
    document.getElementById('domino-btn-winner-t2').innerText = dominoTeam2Name;

    document.getElementById('domino-winner-select-hidden').value = '';
    updateDominoWinnerButtons();
    document.getElementById('domino-setup-section').style.display = 'none';
    document.getElementById('domino-game-section').style.display = 'block';
    document.getElementById('layout-wrapper').classList.add('with-sidebar');
    document.getElementById('game-tabs').classList.add('hidden');
    document.getElementById('domino-team-management').style.display = 'none';
    const resetBtn = document.getElementById('domino-reset-btn-top');
    if (resetBtn) resetBtn.style.display = 'inline-flex';
    const ieContainer = document.getElementById('import-export-container');
    if (ieContainer) ieContainer.style.display = 'none';
    injectDominoSidebar();
    loadDominoTeamPairSideScores(dominoTeam1Name, dominoTeam2Name);
    renderDominoTable();
    const badge = document.getElementById('game-title-badge');
    if (badge) { badge.style.display = 'inline-flex'; badge.textContent = '🁺 Domino'; }
}

function setDominoWinner(val) {
    document.getElementById('domino-winner-select-hidden').value = val;
    updateDominoWinnerButtons();
    haptic(10);

    const loserHandInput = document.getElementById('domino-loser-hand');
    if (loserHandInput && !loserHandInput.disabled) {
        loserHandInput.focus();
        loserHandInput.select();
    }
}

function updateDominoWinnerButtons() {
    const val = document.getElementById('domino-winner-select-hidden').value;
    const b1 = document.getElementById('domino-btn-winner-t1');
    const b2 = document.getElementById('domino-btn-winner-t2');
    b1.classList.toggle('selected', val === '1');
    b2.classList.toggle('selected', val === '2');
}

function loadDominoGlobalRoundsRegistry() {
    try {
        const s = localStorage.getItem('cardGame_domino_globalRoundsRegistry');
        if (s) dominoGlobalRoundsWonRegistry = JSON.parse(s);
    } catch (e) { dominoGlobalRoundsWonRegistry = {}; }
}
function incrementDominoRoundWinMetric(name) {
    if (!dominoGlobalRoundsWonRegistry[name]) dominoGlobalRoundsWonRegistry[name] = 0;
    dominoGlobalRoundsWonRegistry[name]++;
    localStorage.setItem('cardGame_domino_globalRoundsRegistry', JSON.stringify(dominoGlobalRoundsWonRegistry));
}
function decrementDominoRoundWinMetric(name) {
    if (dominoGlobalRoundsWonRegistry[name] > 0) {
        dominoGlobalRoundsWonRegistry[name]--;
        localStorage.setItem('cardGame_domino_globalRoundsRegistry', JSON.stringify(dominoGlobalRoundsWonRegistry));
    }
}

function addDominoRound() {
    const winner = document.getElementById('domino-winner-select-hidden').value;
    if (!winner) { showToast('Who won this round?', 'error'); return; }

    const loserHandEl = document.getElementById('domino-loser-hand');
    const raw = loserHandEl.value;
    if (raw === '') { showToast('Please enter the loser hand points.', 'error'); return; }
    const loserHand = parseInt(raw, 10);
    if (isNaN(loserHand) || loserHand < 0) { showToast('Points must be 0 or more.', 'error'); return; }

    const note = document.getElementById('domino-round-note').value.trim();

    let t1Score, t2Score;
    if (winner === "1") {
        t1Score = loserHand; t2Score = 0;
        incrementDominoRoundWinMetric(dominoTeam1Name);
    } else {
        t1Score = 0; t2Score = loserHand;
        incrementDominoRoundWinMetric(dominoTeam2Name);
    }

    dominoRounds.push({ t1: t1Score, t2: t2Score, winnerTeam: winner === "1" ? dominoTeam1Name : dominoTeam2Name, note });
    saveDominoGameState();

    document.getElementById('domino-round-note').value = '';
    loserHandEl.value = '';

    renderDominoTable(true);
    showToast(`Round added! ${dominoRounds.length}`, 'success');
    haptic(20);

    let t1T = 0, t2T = 0;
    dominoRounds.forEach(r => { t1T += r.t1; t2T += r.t2; });
    if (t1T >= dominoTarget || t2T >= dominoTarget) {
        showToast('Target reached! Declare winner?', 'success', [
            { label: 'Declare a Winner', action: declareDominoWinner }
        ]);
        haptic([30, 50, 30]);
    }
}

function renderDominoTable(flashLast = false) {
    const tbody = document.querySelector('#domino-score-table tbody');
    tbody.innerHTML = '';
    let t1Total = 0, t2Total = 0;
    if (!dominoRounds || !dominoRounds.length) {
        document.getElementById('domino-t1-total').innerText = '0';
        document.getElementById('domino-t2-total').innerText = '0';
        document.getElementById('domino-t1-needs').innerText = dominoTarget;
        document.getElementById('domino-t2-needs').innerText = dominoTarget;
        document.getElementById('domino-t1-needs').className = 'needs-score';
        document.getElementById('domino-t2-needs').className = 'needs-score';
        document.getElementById('domino-declare-winner-btn').disabled = true;
        updateDominoTargetBar(0, 0);
        return;
    }
    dominoRounds.forEach((round, i) => {
        t1Total += round.t1; t2Total += round.t2;
        const tr = document.createElement('tr');
        if (flashLast && i === dominoRounds.length - 1) tr.className = 'row-new';

        let noteHtml = '';
        if (round.note) {
            noteHtml = `<span class="score-row-note-indicator" onclick="event.stopPropagation(); this.parentElement.parentElement.parentElement.nextElementSibling.style.display=this.parentElement.parentElement.parentElement.nextElementSibling.style.display==='none'?'table-row':'none'" title="Show note">💬</span>`;
        }

        const isEditing = dominoEditingRound === i;
        let t1CellContent, t2CellContent, actionsContent;
        if (isEditing) {
            t1CellContent = `<input type="number" class="score-edit-input" id="domino-edit-t1-${i}" value="${round.t1}">`;
            t2CellContent = `<input type="number" class="score-edit-input" id="domino-edit-t2-${i}" value="${round.t2}">`;
            actionsContent = `<button class="score-save-btn" onclick="saveDominoEditScore(${i})" title="Save">✓</button><button class="score-cancel-btn" onclick="cancelDominoEditScore()" title="Cancel">✕</button>`;
        } else {
            const isT1Winner = (round.winnerTeam === dominoTeam1Name);
            const isT2Winner = (round.winnerTeam === dominoTeam2Name);
            const t1WrapClass = `score-val-wrap ${isT1Winner ? 'winner' : 'loser'}${(!isT1Winner && round.t1 === 0) ? ' domino-zero' : ''}`;
            const t2WrapClass = `score-val-wrap ${isT2Winner ? 'winner' : 'loser'}${(!isT2Winner && round.t2 === 0) ? ' domino-zero' : ''}`;

            t1CellContent = `<div style="display:flex;align-items:center;justify-content:center;position:relative;"><span class="${t1WrapClass}">${round.t1}</span>${noteHtml}</div>`;
            t2CellContent = `<div style="display:flex;align-items:center;justify-content:center;position:relative;"><span class="${t2WrapClass}">${round.t2}</span></div>`;
            actionsContent = `<button class="edit-score-btn" onclick="startDominoEditScore(${i})" title="Edit">✎</button><button class="delete-score-btn" onclick="deleteDominoRound(${i})" title="Delete">🗑</button>`;
        }

        const rndBadge = `<span class="rnd-badge">${i + 1}</span>`;
        tr.innerHTML = `<td>${rndBadge}</td><td data-label="${dominoTeam1Name}">${t1CellContent}</td><td data-label="${dominoTeam2Name}">${t2CellContent}</td><td class="actions-cell">${actionsContent}</td>`;
        tbody.appendChild(tr);

        if (round.note) {
            const noteTr = document.createElement('tr');
            noteTr.className = 'note-row';
            noteTr.style.display = 'none';
            noteTr.innerHTML = `<td colspan="4">💬 ${round.note}</td>`;
            tbody.appendChild(noteTr);
        }
    });
    document.getElementById('domino-t1-total').innerText = t1Total;
    document.getElementById('domino-t2-total').innerText = t2Total;

    updateDominoTargetBar(t1Total, t2Total);

    const t1Needs = Math.max(0, dominoTarget - t1Total);
    const t2Needs = Math.max(0, dominoTarget - t2Total);

    document.getElementById('domino-t1-needs').innerText = t1Needs;
    document.getElementById('domino-t2-needs').innerText = t2Needs;

    if (t1Total >= dominoTarget) {
        document.getElementById('domino-t1-needs').className = 'winner-score';
        document.getElementById('domino-t1-needs').innerText = '✓';
    } else {
        if (t1Total > t2Total) {
            document.getElementById('domino-t1-needs').className = 'status-advantage';
        } else if (t1Total < t2Total) {
            document.getElementById('domino-t1-needs').className = 'needs-score';
        } else {
            document.getElementById('domino-t1-needs').className = 'status-tie';
        }
    }
    if (t2Total >= dominoTarget) {
        document.getElementById('domino-t2-needs').className = 'winner-score';
        document.getElementById('domino-t2-needs').innerText = '✓';
    } else {
        if (t2Total > t1Total) {
            document.getElementById('domino-t2-needs').className = 'status-advantage';
        } else if (t2Total < t1Total) {
            document.getElementById('domino-t2-needs').className = 'needs-score';
        } else {
            document.getElementById('domino-t2-needs').className = 'status-tie';
        }
    }

    document.getElementById('domino-declare-winner-btn').disabled = !(t1Total >= dominoTarget || t2Total >= dominoTarget);
}

// Inline score editing for Domino
function startDominoEditScore(roundIndex) {
    dominoEditingRound = roundIndex;
    renderDominoTable();
    setTimeout(() => {
        const input = document.getElementById(`domino-edit-t1-${roundIndex}`);
        if (input) { input.focus(); input.select(); }
    }, 50);
}

function saveDominoEditScore(roundIndex) {
    const t1Input = document.getElementById(`domino-edit-t1-${roundIndex}`);
    const t2Input = document.getElementById(`domino-edit-t2-${roundIndex}`);
    if (!t1Input || !t2Input) return;

    const newT1 = parseInt(t1Input.value, 10);
    const newT2 = parseInt(t2Input.value, 10);

    if (isNaN(newT1) || isNaN(newT2) || newT1 < 0 || newT2 < 0) {
        showToast('Invalid score values', 'error');
        return;
    }

    // Update the round
    const oldRound = dominoRounds[roundIndex];
    if (oldRound.winnerTeam === dominoTeam1Name && newT1 <= newT2) {
        decrementDominoRoundWinMetric(dominoTeam1Name);
        if (newT2 > newT1) incrementDominoRoundWinMetric(dominoTeam2Name);
    } else if (oldRound.winnerTeam === dominoTeam2Name && newT2 <= newT1) {
        decrementDominoRoundWinMetric(dominoTeam2Name);
        if (newT1 > newT2) incrementDominoRoundWinMetric(dominoTeam1Name);
    }

    dominoRounds[roundIndex].t1 = newT1;
    dominoRounds[roundIndex].t2 = newT2;
    dominoRounds[roundIndex].winnerTeam = newT1 > newT2 ? dominoTeam1Name : dominoTeam2Name;

    dominoEditingRound = null;
    saveDominoGameState();
    renderDominoTable();
    showToast('Score updated!', 'success');
}

function cancelDominoEditScore() {
    dominoEditingRound = null;
    renderDominoTable();
}
function deleteDominoRound(index) {
    if (!confirm('Delete this round?')) return;
    const round = dominoRounds[index];
    if (round.winnerTeam === dominoTeam1Name) decrementDominoRoundWinMetric(dominoTeam1Name);
    else if (round.winnerTeam === dominoTeam2Name) decrementDominoRoundWinMetric(dominoTeam2Name);
    dominoRounds.splice(index, 1);
    saveDominoGameState();
    renderDominoTable();
    showToast('Round deleted', 'info');
}

function updateDominoTargetBar(t1, t2) {
    const bar = document.getElementById('domino-target-fill');
    if (!dominoRounds.length) { bar.style.width = '0%'; return; }
    const leaderScore = Math.max(t1, t2);
    const pct = dominoTarget > 0 ? (leaderScore / dominoTarget) * 100 : 0;
    bar.style.width = `${Math.min(100, pct)}%`;
}

function declareDominoWinner() {
    if (!dominoRounds.length) return;
    let t1T = 0, t2T = 0; dominoRounds.forEach(r => { t1T += r.t1; t2T += r.t2; });
    if (t1T === t2T) { showToast('It\'s tied! Play another round.', 'error'); return; }
    const winner = t1T > t2T ? dominoTeam1Name : dominoTeam2Name;
    const roundsCount = dominoRounds.length;
    const totalScore = t1T > t2T ? t1T : t2T;
    const margin = Math.abs(t1T - t2T);

    adjustDominoSideScore(t1T > t2T ? 't1Sub' : 't2Sub', 1);
    archiveDominoMatch(winner);

    showVictoryCelebration(winner, roundsCount, totalScore, margin);

    dominoRounds = []; saveDominoGameState(); renderDominoTable();
}

function resetDominoGame() {
    if (!confirm('End this Domino game?')) return;
    localStorage.removeItem('cardGame_domino_activeGame'); dominoRounds = [];
    removeSidebar();
    showDominoSetup(); updateTeamsUI(); calculateAndRenderDominoLeaderboard();
}

// ── Cards Side scores ───────────────────────────────────────────────────────
function getMatchKey(a, b) { return [a.trim(), b.trim()].sort().join('|||'); }

function injectSidebar() {
    const layout = document.getElementById('layout-wrapper');
    if (layout.querySelector('.right-rail')) return;
    const rail = document.createElement('div');
    rail.className = 'right-rail';
    rail.innerHTML = `
        <div id="sidebar-tracker" class="sidebar" style="display:block;">
            <h2>Overall Score</h2>
            <div class="info-text">Scores bound to active team pair</div>
            <div class="sidebar-team-section">
                <div id="side-t1-title" class="sidebar-team-title">${team1Name}</div>
                <div class="counter-row">
                    <span class="counter-label">Main Score</span>
                    <span id="val-t1Main" class="counter-value">0</span>
                </div>
                <div class="counter-row">
                    <span class="counter-label">Sub Score</span>
                    <span id="val-t1Sub" class="counter-value">0</span>
                </div>
            </div>
            <div class="sidebar-team-section">
                <div id="side-t2-title" class="sidebar-team-title">${team2Name}</div>
                <div class="counter-row">
                    <span class="counter-label">Main Score</span>
                    <span id="val-t2Main" class="counter-value">0</span>
                </div>
                <div class="counter-row">
                    <span class="counter-label">Sub Score</span>
                    <span id="val-t2Sub" class="counter-value">0</span>
                </div>
            </div>
            <button onclick="resetSideScores()" style="margin-top:16px;width:100%;background:none;border:1px solid var(--border);border-radius:8px;padding:8px 12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--text-muted);font-size:12px;font-weight:500;letter-spacing:0.03em;transition:color 0.2s,border-color 0.2s,background 0.2s;" onmouseover="this.style.color='var(--danger,#f87171)';this.style.borderColor='var(--danger,#f87171)';this.style.background='rgba(248,113,113,0.06)'" onmouseout="this.style.color='var(--text-muted)';this.style.borderColor='var(--border)';this.style.background='none'">
                <span style="font-size:14px;">↺</span>
                <span>Reset Counters</span>
            </button>
        </div>
    `;
    layout.appendChild(rail);
}

function removeSidebar() {
    const rail = document.querySelector('.right-rail');
    if (rail) rail.remove();
}

function loadTeamPairSideScores(t1, t2) {
    try {
        const s = localStorage.getItem('cardGame_globalSideRegistry');
        if (s) globalSideTrackerRegistry = JSON.parse(s);
    } catch (e) { globalSideTrackerRegistry = {}; }
    const saved = globalSideTrackerRegistry[getMatchKey(t1, t2)];
    if (saved) { const a = t1.trim() <= t2.trim(); currentSideScores = a ? { ...saved } : { t1Main: saved.t2Main, t1Sub: saved.t2Sub, t2Main: saved.t1Main, t2Sub: saved.t1Sub }; }
    else currentSideScores = { t1Main: 0, t1Sub: 0, t2Main: 0, t2Sub: 0 };
    renderSideScores();
}

function saveTeamPairSideScores() {
    const a = team1Name.trim() <= team2Name.trim();
    const p = a ? { ...currentSideScores } : { t1Main: currentSideScores.t2Main, t1Sub: currentSideScores.t2Sub, t2Main: currentSideScores.t1Main, t2Sub: currentSideScores.t1Sub };
    globalSideTrackerRegistry[getMatchKey(team1Name, team2Name)] = p;
    localStorage.setItem('cardGame_globalSideRegistry', JSON.stringify(globalSideTrackerRegistry));
}

function adjustSideScore(key, amount) {
    const ns = currentSideScores[key] + amount; if (ns < 0) return;
    currentSideScores[key] = ns;
    if (key === 't1Sub' && currentSideScores.t1Sub >= cardsSubRollover) { currentSideScores.t1Sub = 0; currentSideScores.t1Main++; showToast(`${team1Name} — ${formatSubRolloverToast(cardsSubRollover)}`, 'success'); haptic([30, 50, 30]); }
    if (key === 't2Sub' && currentSideScores.t2Sub >= cardsSubRollover) { currentSideScores.t2Sub = 0; currentSideScores.t2Main++; showToast(`${team2Name} — ${formatSubRolloverToast(cardsSubRollover)}`, 'success'); haptic([30, 50, 30]); }
    saveTeamPairSideScores(); renderSideScores();
}

function renderSideScores() {
    Object.keys(currentSideScores).forEach(k => { const el = document.getElementById(`val-${k}`); if (el) el.innerText = currentSideScores[k]; });
}

function resetSideScores() {
    if (!confirm('Reset counters to 0 for this match?')) return;
    currentSideScores = { t1Main: 0, t1Sub: 0, t2Main: 0, t2Sub: 0 }; saveTeamPairSideScores(); renderSideScores();
    showToast('Match counters reset.', 'info');
}

// ── Domino Side scores ──────────────────────────────────────────────────────
function injectDominoSidebar() {
    const layout = document.getElementById('layout-wrapper');
    if (layout.querySelector('.right-rail')) return;
    const rail = document.createElement('div');
    rail.className = 'right-rail';
    rail.innerHTML = `
        <div id="domino-sidebar-tracker" class="sidebar" style="display:block;">
            <h2>Overall Score</h2>
            <div class="info-text">Scores bound to active team pair</div>
            <div class="sidebar-team-section">
                <div id="domino-side-t1-title" class="sidebar-team-title">${dominoTeam1Name}</div>
                <div class="counter-row">
                    <span class="counter-label">Main Score</span>
                    <span id="domino-val-t1Main" class="counter-value">0</span>
                </div>
                <div class="counter-row">
                    <span class="counter-label">Sub Score</span>
                    <span id="domino-val-t1Sub" class="counter-value">0</span>
                </div>
            </div>
            <div class="sidebar-team-section">
                <div id="domino-side-t2-title" class="sidebar-team-title">${dominoTeam2Name}</div>
                <div class="counter-row">
                    <span class="counter-label">Main Score</span>
                    <span id="domino-val-t2Main" class="counter-value">0</span>
                </div>
                <div class="counter-row">
                    <span class="counter-label">Sub Score</span>
                    <span id="domino-val-t2Sub" class="counter-value">0</span>
                </div>
            </div>
            <button onclick="resetDominoSideScores()" style="margin-top:16px;width:100%;background:none;border:1px solid var(--border);border-radius:8px;padding:8px 12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;color:var(--text-muted);font-size:12px;font-weight:500;letter-spacing:0.03em;transition:color 0.2s,border-color 0.2s,background 0.2s;" onmouseover="this.style.color='var(--danger,#f87171)';this.style.borderColor='var(--danger,#f87171)';this.style.background='rgba(248,113,113,0.06)'" onmouseout="this.style.color='var(--text-muted)';this.style.borderColor='var(--border)';this.style.background='none'">
                <span style="font-size:14px;">↺</span>
                <span>Reset Counters</span>
            </button>
        </div>
    `;
    layout.appendChild(rail);
}

function loadDominoTeamPairSideScores(t1, t2) {
    try {
        const s = localStorage.getItem('cardGame_domino_globalSideRegistry');
        if (s) dominoGlobalSideTrackerRegistry = JSON.parse(s);
    } catch (e) { dominoGlobalSideTrackerRegistry = {}; }
    const saved = dominoGlobalSideTrackerRegistry[getMatchKey(t1, t2)];
    if (saved) { const a = t1.trim() <= t2.trim(); dominoCurrentSideScores = a ? { ...saved } : { t1Main: saved.t2Main, t1Sub: saved.t2Sub, t2Main: saved.t1Main, t2Sub: saved.t1Sub }; }
    else dominoCurrentSideScores = { t1Main: 0, t1Sub: 0, t2Main: 0, t2Sub: 0 };
    renderDominoSideScores();
}

function saveDominoTeamPairSideScores() {
    const a = dominoTeam1Name.trim() <= dominoTeam2Name.trim();
    const p = a ? { ...dominoCurrentSideScores } : { t1Main: dominoCurrentSideScores.t2Main, t1Sub: dominoCurrentSideScores.t2Sub, t2Main: dominoCurrentSideScores.t1Main, t2Sub: dominoCurrentSideScores.t1Sub };
    dominoGlobalSideTrackerRegistry[getMatchKey(dominoTeam1Name, dominoTeam2Name)] = p;
    localStorage.setItem('cardGame_domino_globalSideRegistry', JSON.stringify(dominoGlobalSideTrackerRegistry));
}

function adjustDominoSideScore(key, amount) {
    const ns = dominoCurrentSideScores[key] + amount; if (ns < 0) return;
    dominoCurrentSideScores[key] = ns;
    if (key === 't1Sub' && dominoCurrentSideScores.t1Sub >= dominoSubRollover) { dominoCurrentSideScores.t1Sub = 0; dominoCurrentSideScores.t1Main++; showToast(`${dominoTeam1Name} — ${formatSubRolloverToast(dominoSubRollover)}`, 'success'); haptic([30, 50, 30]); }
    if (key === 't2Sub' && dominoCurrentSideScores.t2Sub >= dominoSubRollover) { dominoCurrentSideScores.t2Sub = 0; dominoCurrentSideScores.t2Main++; showToast(`${dominoTeam2Name} — ${formatSubRolloverToast(dominoSubRollover)}`, 'success'); haptic([30, 50, 30]); }
    saveDominoTeamPairSideScores(); renderDominoSideScores();
}

function renderDominoSideScores() {
    Object.keys(dominoCurrentSideScores).forEach(k => { const el = document.getElementById(`domino-val-${k}`); if (el) el.innerText = dominoCurrentSideScores[k]; });
}

function resetDominoSideScores() {
    if (!confirm('Reset counters to 0 for this match?')) return;
    dominoCurrentSideScores = { t1Main: 0, t1Sub: 0, t2Main: 0, t2Sub: 0 }; saveDominoTeamPairSideScores(); renderDominoSideScores();
    showToast('Match counters reset.', 'info');
}

// ── Sub-score Rollover Settings (setup screen) ─────────────────────────────
function formatSubRolloverToast(n) {
    return 'Sub score hit {n} → +1 main!'.replace('{n}', n);
}

function loadSubRolloverSettings() {
    const legacy = parseInt(localStorage.getItem('cardGame_subRollover') || '', 10);
    const cs = parseInt(localStorage.getItem('cardGame_cardsSubRollover') || (legacy >= 2 ? String(legacy) : '10'), 10);
    const ds = parseInt(localStorage.getItem('cardGame_dominoSubRollover') || (legacy >= 2 ? String(legacy) : '10'), 10);
    cardsSubRollover = (!isNaN(cs) && cs >= 2) ? cs : 10;
    dominoSubRollover = (!isNaN(ds) && ds >= 2) ? ds : 10;
    renderCardsSubRolloverSetup();
    renderDominoSubRolloverSetup();
}

function renderCardsSubRolloverSetup() {
    const el = document.getElementById('val-cards-rollover-setup');
    if (el) el.textContent = cardsSubRollover;
}

function renderDominoSubRolloverSetup() {
    const el = document.getElementById('val-domino-rollover-setup');
    if (el) el.textContent = dominoSubRollover;
}

function changeCardsSubRollover(amount) {
    const next = cardsSubRollover + amount;
    if (next < 2) return;
    cardsSubRollover = next;
    localStorage.setItem('cardGame_cardsSubRollover', cardsSubRollover);
    renderCardsSubRolloverSetup();
}

function changeDominoSubRollover(amount) {
    const next = dominoSubRollover + amount;
    if (next < 2) return;
    dominoSubRollover = next;
    localStorage.setItem('cardGame_dominoSubRollover', dominoSubRollover);
    renderDominoSubRolloverSetup();
}

// ── Cards Leaderboard ───────────────────────────────────────────────────────
function toggleLeaderboardAll() {
    showAllLeaderboard = !showAllLeaderboard;
    const btn = document.getElementById('leaderboard-toggle-btn');
    if (btn) { const s = btn.querySelector('span'); if (s) s.textContent = showAllLeaderboard ? 'Show Top 1' : 'Show All'; }
    calculateAndRenderLeaderboard();
}

function calculateAndRenderLeaderboard() {
    loadGlobalRoundsRegistry();
    let reg = {};
    try { reg = JSON.parse(localStorage.getItem('cardGame_globalSideRegistry') || '{}'); } catch (e) { }

    let map = {};
    cardsSavedTeams.forEach(tm => { map[tm] = { name: tm, mainWins: 0, subWins: 0, roundsWon: globalRoundsWonRegistry[tm] || 0 }; });
    Object.keys(reg).forEach(k => { const ts = k.split('|||'), d = reg[k]; if (map[ts[0]]) { map[ts[0]].mainWins += d.t1Main || 0; map[ts[0]].subWins += d.t1Sub || 0; } if (map[ts[1]]) { map[ts[1]].mainWins += d.t2Main || 0; map[ts[1]].subWins += d.t2Sub || 0; } });
    let sorted = Object.values(map).sort((a, b) => { if (b.mainWins !== a.mainWins) return b.mainWins - a.mainWins; if (b.subWins !== a.subWins) return b.subWins - a.subWins; return b.roundsWon - a.roundsWon; });
    const display = showAllLeaderboard ? sorted : sorted.slice(0, 1);
    const tbody = document.querySelector('#leaderboard-table tbody');
    tbody.innerHTML = '';
    if (!display.length) {
        tbody.innerHTML = `<tr><td class="lb-empty" colspan="5">No leaderboard data available</td></tr>`;
        return;
    }
    const lblTeam = 'Team';
    const lblMain = 'Main';
    const lblSub = 'Sub';
    const lblRnds = 'Rnds';
    display.forEach((row, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="lb-rank">${medal}</td>
            <td class="lb-team" data-label="${lblTeam}" title="${row.name}">${row.name}</td>
            <td class="lb-main" data-label="${lblMain}">${row.mainWins}</td>
            <td class="lb-sub" data-label="${lblSub}">${row.subWins}</td>
            <td class="lb-rnds" data-label="${lblRnds}">${row.roundsWon}</td>`;
        tbody.appendChild(tr);
    });
}

// ── Domino Leaderboard ──────────────────────────────────────────────────────
function toggleDominoLeaderboardAll() {
    dominoShowAllLeaderboard = !dominoShowAllLeaderboard;
    const btn = document.getElementById('domino-leaderboard-toggle-btn');
    if (btn) { const s = btn.querySelector('span'); if (s) s.textContent = dominoShowAllLeaderboard ? 'Show Top 1' : 'Show All'; }
    calculateAndRenderDominoLeaderboard();
}

function calculateAndRenderDominoLeaderboard() {
    loadDominoGlobalRoundsRegistry();
    let reg = {};
    try { reg = JSON.parse(localStorage.getItem('cardGame_domino_globalSideRegistry') || '{}'); } catch (e) { }

    let map = {};
    dominoSavedTeams.forEach(tm => { map[tm] = { name: tm, mainWins: 0, subWins: 0, roundsWon: dominoGlobalRoundsWonRegistry[tm] || 0 }; });
    Object.keys(reg).forEach(k => { const ts = k.split('|||'), d = reg[k]; if (map[ts[0]]) { map[ts[0]].mainWins += d.t1Main || 0; map[ts[0]].subWins += d.t1Sub || 0; } if (map[ts[1]]) { map[ts[1]].mainWins += d.t2Main || 0; map[ts[1]].subWins += d.t2Sub || 0; } });
    let sorted = Object.values(map).sort((a, b) => { if (b.mainWins !== a.mainWins) return b.mainWins - a.mainWins; if (b.subWins !== a.subWins) return b.subWins - a.subWins; return b.roundsWon - a.roundsWon; });
    const display = dominoShowAllLeaderboard ? sorted : sorted.slice(0, 1);
    const tbody = document.querySelector('#domino-leaderboard-table tbody');
    tbody.innerHTML = '';
    if (!display.length) {
        tbody.innerHTML = `<tr><td class="lb-empty" colspan="5">No leaderboard data available</td></tr>`;
        return;
    }
    const lblTeam = 'Team';
    const lblMain = 'Main';
    const lblSub = 'Sub';
    const lblRnds = 'Rnds';
    display.forEach((row, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="lb-rank">${medal}</td>
            <td class="lb-team" data-label="${lblTeam}" title="${row.name}">${row.name}</td>
            <td class="lb-main" data-label="${lblMain}">${row.mainWins}</td>
            <td class="lb-sub" data-label="${lblSub}">${row.subWins}</td>
            <td class="lb-rnds" data-label="${lblRnds}">${row.roundsWon}</td>`;
        tbody.appendChild(tr);
    });
}

// ── Full LocalStorage Data Backup & Restore ──────────────────────────────────
function exportLocalStorageData() {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('cardGame_')) {
            data[key] = localStorage.getItem(key);
        }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: `score_keeper_backup_${new Date().toISOString().slice(0, 10)}.json`
    });
    a.click();
    URL.revokeObjectURL(a.href);
    showToast('Backup exported successfully!', 'success');
    haptic(15);
}

function importLocalStorageData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = function (event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const data = JSON.parse(e.target.result);
                const keys = Object.keys(data);
                if (keys.length === 0 || !keys.every(k => k.startsWith('cardGame_'))) {
                    showToast('Invalid backup file format.', 'error');
                    return;
                }
                if (!confirm('This will restore your settings, saved teams, and match history. Any current configurations will be overwritten. Proceed?')) return;

                // Clear existing cardGame_ keys first
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('cardGame_')) {
                        localStorage.removeItem(key);
                    }
                }

                // Store the imported values
                keys.forEach(k => {
                    localStorage.setItem(k, data[k]);
                });

                showToast('Backup restored! Reloading page...', 'success');
                haptic([30, 50, 30]);
                setTimeout(() => {
                    window.location.reload();
                }, 1200);
            } catch (err) {
                showToast('Failed to parse backup file.', 'error');
            }
        };
        reader.readAsText(file);
    };
    input.click();
}

// ── Init ──────────────────────────────────────────────────────────────────────
window.onload = function () {
    const savedTheme = localStorage.getItem('cardGame_theme');
    applyTheme(savedTheme || 'auto');
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (!localStorage.getItem('cardGame_theme')) applyTheme('auto'); });

    migrateTeamsIfNeeded();
    loadSubRolloverSettings();
    loadDominoTarget();
    loadRoundTypes();
    loadCardsTeams();
    loadDominoTeams();
    loadGlobalRoundsRegistry();
    loadDominoGlobalRoundsRegistry();
    loadMatchHistory();
    loadDominoMatchHistory();
    loadCardsActiveGame();
    loadDominoActiveGame();
    initializeUI();

    if (dominoRounds.length > 0 && rounds.length === 0) {
        switchTab('domino');
    } else {
        switchTab('cards');
    }

    // Global keydown for score editing (Enter to save, Escape to cancel)
    document.addEventListener('keydown', function (e) {
        if (cardsEditingRound !== null) {
            if (e.key === 'Enter') { e.preventDefault(); saveEditScore(cardsEditingRound); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelEditScore(); }
        }
        if (dominoEditingRound !== null) {
            if (e.key === 'Enter') { e.preventDefault(); saveDominoEditScore(dominoEditingRound); }
            else if (e.key === 'Escape') { e.preventDefault(); cancelDominoEditScore(); }
        }
    });
};
