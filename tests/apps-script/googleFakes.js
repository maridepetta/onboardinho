/**
 * Imitação mínima dos serviços do Google usados pelo Onboardinho (planilha, sessão,
 * propriedades, trava, utilitários), para rodar os .gs fora do Apps Script — no Node
 * (testes) e no navegador (teste da tela). Não é usada em produção.
 *
 * Planilha: texto que começa com "=" vira fórmula (como no Sheets) e aparece como
 * "#FORMULA(...)" na leitura; com apóstrofo na frente, vira texto (o apóstrofo some).
 */
(function (global) {
  function createGoogleFakes(opts) {
    var state = { email: (opts && opts.email) || '', owner: (opts && opts.owner) || 'dona@empresa.com' };
    // standalone: projeto criado em script.google.com (sem planilha ligada).
    var standalone = !!(opts && opts.standalone);
    var created = 0;
    var sheets = {};
    var props = {};
    var seq = 0;

    function store(v) {
      if (typeof v === 'string' && v.charAt(0) === "'") return v.slice(1);
      if (typeof v === 'string' && v.charAt(0) === '=') return '#FORMULA(' + v + ')';
      return v;
    }

    function Sheet() { this.rows = []; }
    Sheet.prototype.width = function () {
      return this.rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    };
    Sheet.prototype.getDataRange = function () {
      var w = this.width();
      var rows = this.rows;
      return {
        getValues: function () {
          return rows.map(function (r) {
            var copy = r.slice();
            while (copy.length < w) copy.push('');
            return copy;
          });
        }
      };
    };
    Sheet.prototype.appendRow = function (arr) { this.rows.push(arr.map(store)); return this; };
    Sheet.prototype.getLastRow = function () { return this.rows.length; };
    Sheet.prototype.setFrozenRows = function () { return this; };
    Sheet.prototype.getRange = function (r, c, nr, nc) {
      var rows = this.rows;
      nr = nr || 1;
      nc = nc || 1;
      function cell(i, j, v) {
        while (rows.length < r + i) rows.push([]);
        var row = rows[r - 1 + i];
        while (row.length < c + j) row.push('');
        row[c - 1 + j] = store(v);
      }
      var range = {
        setValues: function (vals) {
          for (var i = 0; i < nr; i++) for (var j = 0; j < nc; j++) cell(i, j, vals[i][j]);
          return range;
        },
        setValue: function (v) { cell(0, 0, v); return range; },
        setFontWeight: function () { return range; }
      };
      return range;
    };

    var ss = {
      getId: function () { return 'planilha-teste'; },
      getUrl: function () { return 'https://docs.google.com/spreadsheets/d/planilha-teste'; },
      getSheetByName: function (n) { return sheets[n] || null; },
      insertSheet: function (n) { sheets[n] = new Sheet(); return sheets[n]; }
    };

    var services = {
      SpreadsheetApp: {
        openById: function () { return ss; },
        getActiveSpreadsheet: function () { return standalone ? null : ss; },
        create: function () { created += 1; return ss; }
      },
      PropertiesService: {
        getScriptProperties: function () {
          return {
            getProperty: function (k) { return Object.prototype.hasOwnProperty.call(props, k) ? props[k] : null; },
            setProperty: function (k, v) { props[k] = String(v); }
          };
        }
      },
      Session: {
        getActiveUser: function () { return { getEmail: function () { return state.email; } }; },
        getEffectiveUser: function () { return { getEmail: function () { return state.owner; } }; },
        getScriptTimeZone: function () { return 'America/Sao_Paulo'; }
      },
      LockService: {
        getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; }
      },
      Utilities: {
        getUuid: function () { seq += 1; return 'id-' + seq; },
        // Só o formato usado pelo app (yyyy-MM-dd), no fuso de São Paulo (UTC-3, sem horário de verão).
        formatDate: function (d) { return new Date(d.getTime() - 3 * 3600000).toISOString().slice(0, 10); }
      },
      Logger: { log: function () {} },
      HtmlService: {
        createHtmlOutputFromFile: function () {
          var out = { setTitle: function () { return out; }, addMetaTag: function () { return out; } };
          return out;
        }
      }
    };

    return {
      services: services,
      sheets: sheets,
      setEmail: function (e) { state.email = e; },
      createdCount: function () { return created; },
      // Cola linhas numa aba como se fosse o admin colando a exportação.
      paste: function (name, rows) { rows.forEach(function (r) { sheets[name].appendRow(r); }); },
      values: function (name) { return sheets[name].getDataRange().getValues(); }
    };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { createGoogleFakes: createGoogleFakes };
  global.createGoogleFakes = createGoogleFakes;
})(typeof globalThis !== 'undefined' ? globalThis : this);
