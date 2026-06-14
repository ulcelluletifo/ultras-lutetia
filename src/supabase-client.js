// ============================================================
// ULTRAS LUTETIA — supabase-client.js
// Remplace gas-shim.js — même interface, backend Supabase
// ============================================================

const SUPABASE_URL = 'https://ypsvdicatkckrxrcyxax.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlwc3ZkaWNhdGtja3J4cmN5eGF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NjI5NjUsImV4cCI6MjA5NzAzODk2NX0.qDWSmYYCB6_95rnwqXjOYqizMFG2VOfUmifw_h6bEmU';


// ── Init client Supabase ──────────────────────────────────────
const { createClient } = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Session courante ──────────────────────────────────────────
let currentUser = null;
let currentMembre = null;

async function initSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    currentMembre = await getMembre(session.user.id);
  }
  return { user: currentUser, membre: currentMembre };
}

// ============================================================
// AUTH
// ============================================================

async function loginByTelegram(pseudoTelegram, password) {
  // On utilise le pseudo Telegram comme email fictif
  const email = pseudoTelegram.toLowerCase().replace('@','') + '@ul.internal';
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error('Identifiants incorrects');
  currentUser = data.user;
  currentMembre = await getMembre(data.user.id);
  return { success: true, membre: currentMembre };
}

async function logout() {
  await sb.auth.signOut();
  currentUser = null;
  currentMembre = null;
  return { success: true };
}

async function changePassword(newPassword) {
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw new Error('Erreur changement mot de passe');
  return { success: true };
}

async function inscription(data) {
  const email = data.pseudoTelegram.toLowerCase().replace('@','') + '@ul.internal';
  const { data: authData, error: authError } = await sb.auth.signUp({
    email,
    password: data.password,
  });
  if (authError) throw new Error(authError.message);

  const { error: membreError } = await sb.from('membres').insert({
    id: authData.user.id,
    pseudo_telegram: data.pseudoTelegram.replace('@',''),
    nom: data.nom,
    prenom: data.prenom,
    email: data.email || null,
    ville: data.ville || null,
    code_postal: data.codePostal || null,
    statut: 'sympathisant',
  });
  if (membreError) throw new Error(membreError.message);
  return { success: true };
}

// ============================================================
// MEMBRES
// ============================================================

async function getMembre(id) {
  const { data, error } = await sb
    .from('membres')
    .select('*, section:sections(nom), membres_cellules(cellule_id, role, cellule:cellules(nom))')
    .eq('id', id || currentUser?.id)
    .single();
  if (error) return null;
  return data;
}

async function getMembreByTelegram(pseudo) {
  const { data } = await sb.from('membres')
    .select('*')
    .eq('pseudo_telegram', pseudo.replace('@',''))
    .single();
  return data;
}

async function getAllMembres(filters = {}) {
  let query = sb.from('membres')
    .select('*, section:sections(nom), membres_cellules(cellule:cellules(nom))')
    .order('nom');
  if (filters.statut) query = query.eq('statut', filters.statut);
  if (filters.section_id) query = query.eq('section_id', filters.section_id);
  if (filters.actif !== undefined) query = query.eq('actif', filters.actif);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

async function updateMembre(id, updates) {
  const { data, error } = await sb.from('membres')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateStatutMembre(membreId, statut) {
  return updateMembre(membreId, { statut });
}

async function updateSectionMembre(membreId, sectionId) {
  return updateMembre(membreId, { section_id: sectionId });
}

async function setEtoilesMembre(membreId, etoiles) {
  return updateMembre(membreId, { etoiles });
}

async function toggleBlocageMembre(membreId, actif) {
  return updateMembre(membreId, { actif });
}

async function adminResetPassword(membreId, newPassword) {
  // Nécessite une Edge Function Supabase en prod
  // Pour le dev, on passe par l'API admin
  const email = await sb.from('membres')
    .select('pseudo_telegram')
    .eq('id', membreId)
    .single();
  // TODO: implémenter via Edge Function
  return { success: true, message: 'Reset envoyé' };
}

// Évaluations
async function setEvaluation(membreId, celluleId, note, commentaire = '') {
  const { data, error } = await sb.from('evaluations').upsert({
    membre_id: membreId,
    cellule_id: celluleId,
    note,
    note_par: currentUser.id,
    commentaire,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'membre_id,cellule_id' });
  if (error) throw error;
  return data;
}

async function getEvaluations(membreId) {
  const { data } = await sb.from('evaluations')
    .select('*, cellule:cellules(nom)')
    .eq('membre_id', membreId);
  return data || [];
}

// ============================================================
// SECTIONS & CELLULES
// ============================================================

async function getSections() {
  const { data } = await sb.from('sections').select('*').eq('actif', true).order('nom');
  return data || [];
}

async function getCellules() {
  const { data } = await sb.from('cellules').select('*').eq('actif', true).order('nom');
  return data || [];
}

async function rattacherCellule(membreId, celluleId, role = 'membre') {
  const { error } = await sb.from('membres_cellules').upsert({
    membre_id: membreId,
    cellule_id: celluleId,
    role,
  }, { onConflict: 'membre_id,cellule_id' });
  if (error) throw error;
  // Mettre à jour le statut si pas encore membre_cellule
  const m = await getMembre(membreId);
  if (!['membre_cellule','bureau','admin'].includes(m.statut)) {
    await updateStatutMembre(membreId, 'membre_cellule');
  }
  return { success: true };
}

// ============================================================
// CALENDRIER
// ============================================================

async function getCalendar() {
  const today = new Date().toISOString().split('T')[0];
  const { data: matchsData } = await sb.from('matchs')
    .select('*').gte('date', today).order('date').limit(20);
  const { data: evtsData } = await sb.from('evenements')
    .select('*').gte('date', today).order('date').limit(10);
  return { matchs: matchsData || [], evenements: evtsData || [] };
}

async function addMatch(matchData) {
  const { data, error } = await sb.from('matchs').insert(matchData).select().single();
  if (error) throw error;
  return data;
}

async function getMatchs() {
  const { data } = await sb.from('matchs').select('*').order('date');
  return data || [];
}

async function deleteMatch(id) {
  const { error } = await sb.from('matchs').delete().eq('id', id);
  if (error) throw error;
  return { success: true };
}

// ============================================================
// CHARTE
// ============================================================

async function getCharteActive() {
  const { data } = await sb.from('chartes')
    .select('*').eq('active', true).single();
  return data;
}

async function signerCharte(charteId) {
  const { error } = await sb.from('signatures_charte').insert({
    membre_id: currentUser.id,
    charte_id: charteId,
  });
  if (error && error.code !== '23505') throw error; // 23505 = duplicate, already signed
  // Mettre à jour le membre
  await updateMembre(currentUser.id, {
    charte_signee: true,
    charte_signee_at: new Date().toISOString()
  });
  currentMembre = await getMembre(currentUser.id);
  return { success: true };
}

async function getMembresNonSignataires() {
  const charteActive = await getCharteActive();
  if (!charteActive) return [];
  const { data: signataires } = await sb.from('signatures_charte')
    .select('membre_id').eq('charte_id', charteActive.id);
  const sigIds = (signataires || []).map(s => s.membre_id);
  const { data } = await sb.from('membres').select('*').not('id', 'in', `(${sigIds.join(',')})`);
  return data || [];
}

// ============================================================
// SESSIONS TIFO
// ============================================================

async function getUpcomingSessions() {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await sb.from('sessions_tifo')
    .select('*, cellule:cellules(nom)')
    .gte('date', today)
    .in('statut', ['a_venir', 'en_cours'])
    .order('date');
  if (error) throw error;
  return data || [];
}

async function getPastSessions() {
  const today = new Date().toISOString().split('T')[0];
  const { data } = await sb.from('sessions_tifo')
    .select('*')
    .lt('date', today)
    .order('date', { ascending: false })
    .limit(20);
  return data || [];
}

async function getSessionDetails(sessionId) {
  const { data } = await sb.from('sessions_tifo')
    .select('*')
    .eq('id', sessionId)
    .single();
  const { data: inscrits } = await sb.from('inscriptions_session')
    .select('*, membre:membres(nom, prenom, pseudo_telegram, etoiles)')
    .eq('session_id', sessionId);
  const monInscrit = (inscrits || []).find(i => i.membre_id === currentUser?.id);
  return { session: data, inscrits: inscrits || [], monInscrit };
}

async function inscrire(sessionId) {
  const { error } = await sb.from('inscriptions_session').insert({
    session_id: sessionId,
    membre_id: currentUser.id,
    statut: 'inscrit',
  });
  if (error && error.code === '23505') throw new Error('Déjà inscrit');
  if (error) throw error;
  return { success: true };
}

async function desinscrire(sessionId) {
  const { error } = await sb.from('inscriptions_session')
    .delete()
    .eq('session_id', sessionId)
    .eq('membre_id', currentUser.id);
  if (error) throw error;
  return { success: true };
}

async function validerPresence(sessionId, code) {
  const { data: session } = await sb.from('sessions_tifo')
    .select('code_presence').eq('id', sessionId).single();
  if (!session || session.code_presence !== code) throw new Error('Code incorrect');
  const { error } = await sb.from('inscriptions_session')
    .update({ statut: 'present', updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('membre_id', currentUser.id);
  if (error) throw error;
  return { success: true };
}

async function savePizzaChoice(sessionId, pizza) {
  const { error } = await sb.from('inscriptions_session')
    .update({ pizza, updated_at: new Date().toISOString() })
    .eq('session_id', sessionId)
    .eq('membre_id', currentUser.id);
  if (error) throw error;
  return { success: true };
}

async function createSession(sessionData) {
  const { data, error } = await sb.from('sessions_tifo').insert({
    ...sessionData,
    cree_par: currentUser.id,
  }).select().single();
  if (error) throw error;
  return data;
}

async function openSession(sessionId) {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  const { data, error } = await sb.from('sessions_tifo')
    .update({ statut: 'en_cours', code_presence: code })
    .eq('id', sessionId).select().single();
  if (error) throw error;
  return { session: data, code };
}

async function closeSession(sessionId) {
  // Marquer les inscrits non présents comme absents
  await sb.from('inscriptions_session')
    .update({ statut: 'absent' })
    .eq('session_id', sessionId)
    .eq('statut', 'inscrit');
  const { data, error } = await sb.from('sessions_tifo')
    .update({ statut: 'terminee', code_presence: null })
    .eq('id', sessionId).select().single();
  if (error) throw error;
  return data;
}

async function deleteSession(sessionId) {
  const { error } = await sb.from('sessions_tifo').delete().eq('id', sessionId);
  if (error) throw error;
  return { success: true };
}

async function updateSession(sessionId, updates) {
  const { data, error } = await sb.from('sessions_tifo')
    .update(updates).eq('id', sessionId).select().single();
  if (error) throw error;
  return data;
}

async function getSessionsWithStats() {
  const { data } = await sb.from('sessions_tifo')
    .select('*, inscriptions_session(statut)')
    .order('date', { ascending: false });
  return (data || []).map(s => ({
    ...s,
    nb_inscrits: s.inscriptions_session?.length || 0,
    nb_presents: s.inscriptions_session?.filter(i => i.statut === 'present').length || 0,
  }));
}

async function updateInscriptionStatut(sessionId, membreId, statut) {
  const { error } = await sb.from('inscriptions_session')
    .update({ statut })
    .eq('session_id', sessionId)
    .eq('membre_id', membreId);
  if (error) throw error;
  return { success: true };
}

async function getPizzaOrders(sessionId) {
  const { data } = await sb.from('inscriptions_session')
    .select('pizza, membre:membres(nom, prenom)')
    .eq('session_id', sessionId)
    .neq('pizza', 'non');
  return data || [];
}

// ============================================================
// DÉPLACEMENTS
// ============================================================

async function getDeplacements(upcoming = true) {
  const today = new Date().toISOString().split('T')[0];
  let query = sb.from('deplacements')
    .select('*, match:matchs(*)')
    .order('date_match');
  if (upcoming) query = query.gte('date_match', today);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getDeplacement(id) {
  const { data } = await sb.from('deplacements')
    .select('*, match:matchs(*)')
    .eq('id', id).single();
  const { data: inscrits } = await sb.from('inscriptions_deplacement')
    .select('*, membre:membres(nom, prenom, pseudo_telegram, etoiles)')
    .eq('deplacement_id', id);
  const monInscrit = (inscrits || []).find(i => i.membre_id === currentUser?.id);
  const nbInscrits = (inscrits || []).length;
  return { deplacement: data, inscrits: inscrits || [], monInscrit, nbInscrits };
}

async function sInscrireDeplacements(deplacementId) {
  const { error } = await sb.from('inscriptions_deplacement').insert({
    deplacement_id: deplacementId,
    membre_id: currentUser.id,
  });
  if (error && error.code === '23505') throw new Error('Déjà inscrit');
  if (error) throw error;
  return { success: true };
}

async function validerPaiementCash(deplacementId, membreId) {
  const qrCode = `UL-${Date.now()}-${membreId.slice(0,6).toUpperCase()}`;
  const { error } = await sb.from('inscriptions_deplacement')
    .update({
      statut_paiement: 'paye_cash',
      valide_par: currentUser.id,
      valide_at: new Date().toISOString(),
      qr_code: qrCode,
    })
    .eq('deplacement_id', deplacementId)
    .eq('membre_id', membreId);
  if (error) throw error;
  return { success: true, qrCode };
}

async function validerPaiementHelloAsso(deplacementId, membreId) {
  const qrCode = `UL-HA-${Date.now()}-${membreId.slice(0,6).toUpperCase()}`;
  const { error } = await sb.from('inscriptions_deplacement')
    .update({
      statut_paiement: 'paye_helloasso',
      valide_par: currentUser.id,
      valide_at: new Date().toISOString(),
      qr_code: qrCode,
    })
    .eq('deplacement_id', deplacementId)
    .eq('membre_id', membreId);
  if (error) throw error;
  return { success: true, qrCode };
}

async function createDeplacement(data) {
  const { data: result, error } = await sb.from('deplacements').insert({
    ...data,
    cree_par: currentUser.id,
  }).select().single();
  if (error) throw error;
  return result;
}

async function getListeBusTelegram(deplacementId) {
  const { inscrits, deplacement } = await getDeplacement(deplacementId);
  const payes = inscrits.filter(i => i.statut_paiement !== 'en_attente');
  const lines = [
    `🚌 *LISTE BUS — ${deplacement.adversaire}*`,
    `📅 ${deplacement.date_match} — ${deplacement.heure_depart || ''}`,
    `📍 RDV: ${deplacement.point_rdv || ''}`,
    ``,
    `✅ *PAYÉS (${payes.length}/${deplacement.places_max})*`,
    ...payes.map((i, n) => `${n+1}. @${i.membre.pseudo_telegram} — ${i.statut_paiement === 'paye_cash' ? 'Cash' : 'HelloAsso'}`),
    ``,
    `⏳ En attente: ${inscrits.length - payes.length}`,
  ];
  return lines.join('\n');
}

// ============================================================
// MATOS
// ============================================================

async function getProduits(niveauAcces = 'tous') {
  const { data } = await sb.from('produits')
    .select('*').eq('statut', 'disponible').order('nom');
  return (data || []).filter(p => {
    if (p.niveau_acces === 'tous') return true;
    if (p.niveau_acces === 'draft_et_plus') return ['draft','confirme','membre_cellule','bureau','admin'].includes(niveauAcces);
    if (p.niveau_acces === 'confirme_et_plus') return ['confirme','membre_cellule','bureau','admin'].includes(niveauAcces);
    return false;
  });
}

async function passerCommande(items) {
  // items = [{produit_id, quantite, taille}]
  const total = items.reduce((sum, item) => sum + (item.prix * item.quantite), 0);
  const { data: commande, error } = await sb.from('commandes').insert({
    membre_id: currentUser.id,
    total,
    statut: 'en_attente',
  }).select().single();
  if (error) throw error;
  await sb.from('commande_items').insert(
    items.map(item => ({
      commande_id: commande.id,
      produit_id: item.produit_id,
      quantite: item.quantite,
      taille: item.taille || null,
      prix_unitaire: item.prix,
    }))
  );
  return commande;
}

async function getMesCommandes() {
  const { data } = await sb.from('commandes')
    .select('*, commande_items(*, produit:produits(nom, photo_url))')
    .eq('membre_id', currentUser.id)
    .order('created_at', { ascending: false });
  return data || [];
}

// ============================================================
// STICKS
// ============================================================

async function getSticksCatalogue() {
  const { data } = await sb.from('sticks_catalogue')
    .select('*').eq('statut', 'disponible').order('nom');
  return data || [];
}

async function distribuerStick(stickId, membreId, quantite = 1, sessionId = null) {
  // Vérifier quota
  const { data: deja } = await sb.from('sticks_distribution')
    .select('quantite').eq('stick_id', stickId).eq('membre_id', membreId);
  const totalDeja = (deja || []).reduce((s, d) => s + d.quantite, 0);
  const { data: stick } = await sb.from('sticks_catalogue').select('quota_par_membre').eq('id', stickId).single();
  if (totalDeja + quantite > stick.quota_par_membre) throw new Error('Quota dépassé');

  const { error } = await sb.from('sticks_distribution').insert({
    stick_id: stickId,
    membre_id: membreId,
    quantite,
    distribue_par: currentUser.id,
    session_id: sessionId,
  });
  if (error) throw error;
  return { success: true };
}

// ============================================================
// COTISATIONS
// ============================================================

async function getMaCotisation(saison) {
  const { data } = await sb.from('cotisations')
    .select('*')
    .eq('membre_id', currentUser.id)
    .eq('saison', saison)
    .single();
  return data;
}

async function validerCotisation(membreId, montant, saison, modePaiement = 'cash') {
  const { error } = await sb.from('cotisations').upsert({
    membre_id: membreId,
    saison,
    montant,
    mode_paiement: modePaiement,
    statut: 'paye',
    valide_par: currentUser.id,
    paye_at: new Date().toISOString(),
  }, { onConflict: 'membre_id,saison' });
  if (error) throw error;
  await updateMembre(membreId, { cotisation_a_jour: true });
  return { success: true };
}

// ============================================================
// ANNONCES
// ============================================================

async function getAnnonces() {
  const { data } = await sb.from('annonces')
    .select('*, publie_par:membres(nom, prenom), cellule:cellules(nom)')
    .eq('actif', true)
    .order('created_at', { ascending: false })
    .limit(10);
  return data || [];
}

async function publierAnnonce(titre, contenu, categorie = 'info', celluleId = null) {
  const { error } = await sb.from('annonces').insert({
    titre, contenu, categorie,
    cellule_id: celluleId,
    publie_par: currentUser.id,
  });
  if (error) throw error;
  return { success: true };
}

// ============================================================
// STATS
// ============================================================

async function getStats() {
  const [membres, sessions, deplacements] = await Promise.all([
    sb.from('membres').select('statut, section_id', { count: 'exact' }),
    sb.from('sessions_tifo').select('id', { count: 'exact' }),
    sb.from('deplacements').select('id', { count: 'exact' }),
  ]);
  return {
    totalMembres: membres.count || 0,
    totalSessions: sessions.count || 0,
    totalDeplacements: deplacements.count || 0,
    repartitionStatuts: (membres.data || []).reduce((acc, m) => {
      acc[m.statut] = (acc[m.statut] || 0) + 1;
      return acc;
    }, {}),
  };
}

async function getMesStats() {
  const [inscriptions, presences, depls] = await Promise.all([
    sb.from('inscriptions_session').select('statut').eq('membre_id', currentUser.id),
    sb.from('inscriptions_session').select('id').eq('membre_id', currentUser.id).eq('statut','present'),
    sb.from('inscriptions_deplacement').select('statut_paiement').eq('membre_id', currentUser.id),
  ]);
  const totalInscrits = inscriptions.data?.length || 0;
  const totalPresents = presences.data?.length || 0;
  return {
    sessionsInscrites: totalInscrits,
    sessionsPresent: totalPresents,
    tauxPresence: totalInscrits > 0 ? Math.round((totalPresents / totalInscrits) * 100) : 0,
    deplacements: depls.data?.length || 0,
  };
}

// ============================================================
// EXPORT GLOBAL
// ============================================================

window.UL = {
  initSession,
  // Auth
  loginByTelegram, logout, changePassword, inscription,
  // Membres
  getMembre, getAllMembres, updateMembre, updateStatutMembre,
  updateSectionMembre, setEtoilesMembre, toggleBlocageMembre,
  adminResetPassword, setEvaluation, getEvaluations,
  // Référentiels
  getSections, getCellules, rattacherCellule,
  // Calendrier
  getCalendar, addMatch, getMatchs, deleteMatch,
  // Charte
  getCharteActive, signerCharte, getMembresNonSignataires,
  // Sessions Tifo
  getUpcomingSessions, getPastSessions, getSessionDetails,
  inscrire, desinscrire, validerPresence, savePizzaChoice,
  createSession, openSession, closeSession, deleteSession,
  updateSession, getSessionsWithStats, updateInscriptionStatut, getPizzaOrders,
  // Déplacements
  getDeplacements, getDeplacement, sInscrireDeplacements,
  validerPaiementCash, validerPaiementHelloAsso, createDeplacement, getListeBusTelegram,
  // Matos
  getProduits, passerCommande, getMesCommandes,
  // Sticks
  getSticksCatalogue, distribuerStick,
  // Cotisations
  getMaCotisation, validerCotisation,
  // Annonces
  getAnnonces, publierAnnonce,
  // Stats
  getStats, getMesStats,
  // Direct Supabase access
  sb, getCurrentUser: () => currentUser, getCurrentMembre: () => currentMembre,
};
