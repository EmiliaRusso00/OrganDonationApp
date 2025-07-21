window.addEventListener('DOMContentLoaded', () => {
    const savedTime = localStorage.getItem("lastTime");
    if (savedTime) {
        document.getElementById('popup-start-hour').value = savedTime;
    }
});


// Funzione per mostrare un messaggio nel modal personalizzato
function showModal(message) {
    const modal = document.getElementById('customModal');
    const modalMessage = document.getElementById('modalMessage');
    const closeButton = document.querySelector('.close-button');

    modalMessage.textContent = message;
    modal.classList.remove('hidden');

    closeButton.onclick = () => modal.classList.add('hidden');
    window.onclick = event => {
        if (event.target === modal) modal.classList.add('hidden');
    };
}
let currentTaskForNote = null;

function openNotePopup(task) {
  currentTaskForNote = task;
  document.getElementById('noteInput').value = task.note || '';
  document.getElementById('notePopup').style.display = 'block';
}

function closeNotePopup() {
  document.getElementById('notePopup').style.display = 'none';
  currentTaskForNote = null;
}
document.getElementById('saveNoteBtn').addEventListener('click', () => {
  const noteText = document.getElementById('noteInput').value.trim();
  if (!currentTaskForNote) return;

  // 🚀 Log prima di invocare l’IPC
  console.log('[RENDERER] Chiamo updateTask con:', {
    id: currentTaskForNote.id,
    note: noteText
  });

  window.api.updateTask({
    id: currentTaskForNote.id,
    status: null,
    note: noteText
  })
  .then(result => {
    // 🚀 Log all’ingresso nel .then
    console.log('[RENDERER] updateTask resolved con:', result);

    if (result.changes === 0) {
      console.warn('[RENDERER] result.changes === 0, lancio errore');
      throw new Error('Nessuna modifica applicata');
    }

    console.log("Nota aggiornata con successo:", result);
    closeNotePopup();

    // Rigenera il Gantt
    const container = document.getElementById('container');
    if (container) container.innerHTML = "";

    const savedTime     = localStorage.getItem("lastTime");
    const savedOperator = localStorage.getItem("lastOperator") || '';
    generateGanttFromInput(savedTime, savedOperator);
  })
  .catch(err => {
    // 🚀 Log completo dell’errore catturato
    console.error('[RENDERER] Errore nel salvataggio nota:', err);

    showModal("Errore durante il salvataggio della nota. Controlla la console.");
  });
});



// Click su "Genera" → salva orario e genera Gantt
document.getElementById('popup-generate').addEventListener('click', () => {
    const inputHour = document.getElementById('popup-start-hour').value;
    const operatorName = document.getElementById('popup-operator').value.trim();

    if (!inputHour) {
        showModal("Seleziona un orario valido (es. 08:30).");
        return;
    }

    if (!operatorName) {
        showModal("Inserisci il nome e cognome dell'operatore corrente.");
        return;
    }

    // Salva in localStorage
    localStorage.setItem("lastTime", inputHour);
    localStorage.setItem("lastOperator", operatorName);

    // Chiudi il popup
    document.getElementById('timePopup').style.display = 'none';
    document.getElementById('reenterTimeBtn').style.display = 'block';

    // Genera il Gantt con orario e operatore
    generateGanttFromInput(inputHour, operatorName);
});


document.getElementById('reenterTimeBtn').addEventListener('click', () => {
// Rimuovi il Gantt attuale (puliamo il container)
    const container = document.getElementById('container');
    if (container) {
        container.innerHTML = "";
    }

    // Mostra il popup per reinserire orario
    document.getElementById('timePopup').style.display = 'flex';

    // Nascondi il pulsante "reinserisci orario" finché non si genera un nuovo Gantt
    document.getElementById('reenterTimeBtn').style.display = 'none';

    // Se c'è un orario salvato, mettilo nel campo input
    const savedTime = localStorage.getItem("lastTime");
    if (savedTime) {
        document.getElementById('popup-start-hour').value = savedTime;
    }
});


// Funzione per generare il Gantt da una stringa HH:mm
function generateGanttFromInput(inputHour) {
        const container = document.getElementById('container');
    if (container) {
        container.innerHTML = ""; // Cancella il vecchio Gantt
    }
    const [hh, mm] = inputHour.split(':');
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hh), parseInt(mm), 0);
    // Creazione del Gantt con l'orario specificato
    renderGantt(startTime); 
}


function renderGantt(startTime) {
    const taskHeight = 50;
    const taskPadding = 15;
    const minuteWidth = 5;
    const totalMinutes = 24 * 60;
    const endTime = new Date(startTime.getTime() + totalMinutes * 60000);
    const svgWidth = totalMinutes * minuteWidth + 600;
    const chartHeight = 1490;

    const svg = d3.select('#container')
        .append('svg')
        .attr('width', svgWidth + 220)
        .attr('height', chartHeight + 1300)
        .style('overflow','visible');
    // Aggiungi immagine di sfondo
    
    const tooltip = d3.select('#tooltip');

    const x = d3.scaleTime()
        .domain([startTime, endTime])
        .range([150, svgWidth - 100]);
    
            const legendGroup = svg.append('g')
        .attr('transform', 'translate(20, 20)'); // Posizione in alto a sinistra

        
        legendGroup.append('rect')
            .attr('x', 0)
            .attr('y', -22)
            .attr('width', 300)
            .attr('height', 165)
            .attr('rx', 10)
            .attr('fill', 'white');

        // Dati della leggenda
        const legendItems = [
            { color: 'rgba(75, 73, 227, 1)', label: 'Non iniziato' },
            { color: 'rgb(233, 238, 160)', label: 'Richiesto' },
            { color: 'rgb(255, 197, 72)', label: 'Iniziato' },
            { color: 'rgb(160, 248, 175)', label: 'Terminato o non Richiesto' },
            { symbol: '\u25C0', label: 'Torna indietro azione precedente' },
            { symbol: '\u25B6', label: 'Vai avanti azione successiva' }
        ];

        // Layout
        legendItems.forEach((item, i) => {
            const yOffset = 15 + i * 20;

            if (item.color) {
                // Rettangolo colorato
                legendGroup.append('rect')
                    .attr('x', 10)
                    .attr('y', yOffset)
                    .attr('width', 15)
                    .attr('height', 15)
                    .attr('fill', item.color);

                // Etichetta
                legendGroup.append('text')
                    .attr('x', 30)
                    .attr('y', yOffset + 12)
                    .attr('fill', 'black')
                    .attr('font-size', '17px')
                    .text(item.label);
            } else if (item.symbol) {
                // Freccia e descrizione
                legendGroup.append('text')
                    .attr('x', 10)
                    .attr('y', yOffset + 12)
                    .attr('fill', 'black')
                    .attr('font-size', '17px')
                    .text(`${item.symbol} ${item.label}`);
            }
        });

        // Titolo della leggenda
        legendGroup.append('text')
            .attr('x', 10)
            .attr('y', 3)
            .attr('fill', 'black')
            .attr('font-weight', 'bold')
            .attr('font-size', '19px')
            .text('Leggenda Task:');

    const rectHeight = 90;
    const dayStart = new Date(startTime);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(24, 0, 0, 0);

    svg.append('rect')
        .attr('x', x(dayStart)+220)
        .attr('y', 10)
        .attr('width', x(dayEnd) - x(dayStart))
        .attr('height', rectHeight)
        .attr('fill', '#c89bffff')
        .lower();

    svg.append('rect')
        .attr('x', x(dayEnd)+220)
        .attr('y', 10)
        .attr('width', x(endTime) - x(dayEnd))
        .attr('height', rectHeight)
        .attr('fill', '#c89bffff')
        .lower();

    svg.append('line')
        .attr('x1', x(dayEnd)+220)
        .attr('y1', 10)
        .attr('x2', x(dayEnd)+220)
        .attr('y2', 10 + rectHeight)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);

    const localeIt = d3.timeFormatLocale({
        "dateTime": "%A %e %B %Y, %X",
        "date": "%d/%m/%Y",
        "time": "%H:%M:%S",
        "periods": ["AM", "PM"],
        "days": ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"],
        "shortDays": ["dom", "lun", "mar", "mer", "gio", "ven", "sab"],
        "months": ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
                    "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"],
        "shortMonths": ["gen", "feb", "mar", "apr", "mag", "giu",
                        "lug", "ago", "set", "ott", "nov", "dic"]
        });
    const formatIt = localeIt.format('%B %d');

    svg.append('text')
        .attr('x', ((x(dayStart)+220) + (x(dayEnd)+220)) / 2)
        .attr('y', 60)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-weight', 'bold')
        .attr('font-size', '30px') 
        .text(formatIt(dayStart));

    svg.append('text')
        .attr('x', ((x(dayEnd)+220) + (x(endTime)+220)) / 2)
        .attr('y', 60)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-weight', 'bold')
        .attr('font-size', '30px') 
        .text(formatIt(dayEnd));

    for (let i = 0; i <= totalMinutes; i++) {
        const time = new Date(startTime.getTime() + i * 60000);
        const xPos = x(time)+220;

        svg.append('line')
            .attr('x1', xPos)
            .attr('y1', rectHeight + 30)
            .attr('x2', xPos)
            .attr('y2', rectHeight+52)
            .attr('stroke', 'rgb(255, 255, 255)')
            .attr('stroke-width', i % 60 === 0 ? 5.5 : 0.8);

        if (i % 60 === 0) {
            svg.append('text')
                .attr('x', xPos + 5)
                .attr('y', rectHeight + 24)
                .text(d3.timeFormat('%H:%M')(time))
                .attr('font-size', '15px');
        }
    }

    const currentLine = svg.append('line')
        .attr('y1', rectHeight+20)
        .attr('y2', chartHeight + 1300)
        .attr('stroke', 'red')
        .attr('stroke-width', 2)


    const currentTimeText = svg.append('text')
        .attr('y', chartHeight + 1280)
        .attr('fill', 'red')
        .attr('font-size', '20px');
    const currentTimeTextTop = svg.append('text')
        .attr('y', 160) 
        .attr('fill', 'red')
        .attr('font-size', '20px');

    // Linea fissa per le 18 ore trascorse dall'inizio
    const eighteenHoursLater = new Date(startTime.getTime() + 18 * 60 * 60 * 1000);
    const xEighteenHours = x(eighteenHoursLater) + 220;

    svg.append('line')
        .attr('x1', xEighteenHours)
        .attr('y1', rectHeight + 20)
        .attr('x2', xEighteenHours)
        .attr('y2', chartHeight + 1300)
        .attr('stroke', 'black')
        .attr('stroke-width', 2);

    // Etichetta "18h" sotto la linea
    svg.append('text')
        .attr('x', xEighteenHours + 5)
        .attr('y', chartHeight + 1260)
        .attr('fill', 'black')
        .attr('font-size', '20px')
        .text('18h - COMPLETAMENTO IDEALE DI TUTTE LE ATTIVITÀ ');
    
        svg.append('text')
        .attr('x', xEighteenHours + 5)
        .attr('y', 180)
        .attr('fill', 'black')
        .attr('font-size', '20px')
        .text('18h - COMPLETAMENTO IDEALE DI TUTTE LE ATTIVITÀ ');

    function updateCurrentTime() {
        const now = new Date();
        const clamped = Math.max(startTime.getTime(), Math.min(now.getTime(), endTime.getTime()));
        const xPos = x(new Date(clamped));
        const offset = 220;

        currentLine.attr('x1', xPos + offset).attr('x2', xPos + offset);
        
        const timeString = d3.timeFormat('%H:%M:%S')(now);

        currentTimeText
            .attr('x', xPos + offset + 5)
            .text(timeString);

        currentTimeTextTop
            .attr('x', xPos + offset + 5)
            .text(timeString);
    }

    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);

    function scheduleTasks(tasks) {
        const taskMap = new Map(tasks.map(t => [t.id, t]));
        const scheduled = new Map();

        function computeStart(task) {
            if (scheduled.has(task.id)) return scheduled.get(task.id);

            if (task.startOffsetHours !== undefined && task.startOffsetHours !== null) {
                // Calcola startTime + offset_inizio_ore in millisecondi
                const start = new Date(startTime.getTime() + task.startOffsetHours * 60 * 60 * 1000);
                scheduled.set(task.id, start);
                return start;
            }


            // Caso senza offset_inizio_ore: considera le dipendenze come prima
            if (!task.dependencies || task.dependencies.length === 0) {
                scheduled.set(task.id, new Date(startTime));
                return new Date(startTime);
            }

            let maxEnd = new Date(startTime);
            for (let depId of task.dependencies) {
                const depTask = taskMap.get(depId);
                const depStart = computeStart(depTask);
                const depEnd = new Date(depStart.getTime() + depTask.duration * 60000);
                if (depEnd > maxEnd) maxEnd = depEnd;
            }

            scheduled.set(task.id, maxEnd);
            return maxEnd;
        }

        tasks.forEach(task => {
            task.start = computeStart(task);
            task.end = new Date(task.start.getTime() + task.duration * 60000);
        });
    }


    window.api.getTasks()
  .then(data => {
    data.forEach(task => {
      task.id = parseInt(task.id, 10);
      task.dependencies = task.dependencies.map(dep => parseInt(dep, 10));
    });

    scheduleTasks(data);
    data.forEach((d, i) => d.y = 140 + i * (taskHeight + taskPadding));

    const statusColors = {
      non_iniziato: 'rgba(75, 73, 227, 1)',
      richiesto: 'rgb(233, 238, 160)',
      iniziato: 'rgb(255, 197, 72)',
      terminato: 'rgb(160, 248, 175)'
    };

    const idToName = new Map(data.map(t => [t.id, t.name]));

    const groups = svg.selectAll('.task')
      .data(data)
      .enter()
      .append('g')
      .each(function(d) {
        const g = d3.select(this);

        g.append('rect')
          .attr('class', 'task')
          .attr('x', x(d.start) + 220)
          .attr('y', d.y + 30)
          .attr('width', x(d.end) - x(d.start))
          .attr('height', taskHeight)
          .attr('fill', statusColors[d.status] || '#ccc')
          .attr('stroke', '#000')
          .on('click', () => {
            openNotePopup(d);
          })
          .on('mouseover', (event) => {
            const deps = d.dependencies.length
              ? d.dependencies.map(id => idToName.get(id)).join(', ')
              : 'Nessuna';

            let statusText = 'Non Iniziato';
            if (d.status === 'terminato') statusText = 'Terminato o non Richiesto';
            else if (d.status === 'richiesto') statusText = 'Richiesto';
            else if (d.status === 'iniziato') statusText = 'Iniziato';

            let tooltipHtml = `
              <strong><span class="task-name">${d.name}</span></strong><br/>
              <strong>Durata:</strong> ${d.duration} min<br/>
            `;

            if (d.description && d.description.trim() !== '') {
              tooltipHtml += `<strong>Descrizione:</strong> ${d.description}<br/>`;
            }

            tooltipHtml += `
              <strong>Dipendenze:</strong> ${deps}<br/>
              <strong>Stato:</strong> ${statusText}<br/>
              <strong>Nota:</strong> ${d.note || 'Nessuna'}
            `;

            tooltip.style('opacity', 1)
              .html(tooltipHtml)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY + 10) + 'px');
          })
          .on('mousemove', (event) => {
            tooltip.style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY + 10) + 'px');
          })
          .on('mouseout', () => {
            tooltip.style('opacity', 0);
          });

        const forwardArrow = g.append('text')
          .attr('x', x(d.end) + 235)
          .attr('y', d.y + taskHeight / 2 + 40)
          .text('\u25B6')
          .attr('font-size', '27px')
          .attr('fill', d.status === 'terminato' ? 'gray' : '#000')
          .style('cursor', 'pointer')
          .on('click', function() {
            function dependenciesCompleted(task) {
              if (!task.dependencies || task.dependencies.length === 0) return true;
              return task.dependencies.every(depId => {
                const depTask = data.find(t => t.id === depId);
                return depTask && depTask.status === 'terminato';
              });
            }

            if (d.status === 'non_iniziato') {
              if (dependenciesCompleted(d)) {
                d.status = 'richiesto';
                g.select('rect').attr('fill', statusColors[d.status]);
                updateTaskStatus(d.id, 'richiesto');
              } else {
                const incompleteDeps = d.dependencies
                  .map(depId => data.find(t => t.id === depId))
                  .filter(depTask => depTask && depTask.status !== 'terminato');
                const names = incompleteDeps.map(t => t.name).join(', ');
                showModal(`Non puoi avviare questo task finché non sono completati i seguenti task: ${names}`);
              }
            } else if (d.status === 'richiesto') {
              if (dependenciesCompleted(d)) {
                d.status = 'iniziato';
                g.select('rect').attr('fill', statusColors[d.status]);
                updateTaskStatus(d.id, 'iniziato');
              }
            } else if (d.status === 'iniziato') {
              d.status = 'terminato';
              g.select('rect').attr('fill', statusColors[d.status]);
              forwardArrow.attr('fill','gray');
              updateTaskStatus(d.id, 'terminato');
            }
          });

        g.append('text')
          .attr('x', x(d.start) + 180)
          .attr('y', d.y + taskHeight / 2 + 40)
          .text('\u25C0')
          .attr('font-size', '27px')
          .attr('fill', '#000')
          .style('cursor', 'pointer')
          .on('click', function() {
            const dependentTasks = data.filter(t => t.dependencies && t.dependencies.includes(d.id));
            const anyDependentActive = dependentTasks.some(t => t.status !== 'non_iniziato');

            if (anyDependentActive) {
              const names = dependentTasks.map(t => t.name).join(', ');
              showModal(`Non puoi tornare indietro con questo task perché i seguenti task dipendenti sono già stati attivati: ${names}`);
              return;
            }

            if (d.status === 'terminato') {
              d.status = 'iniziato';
              forwardArrow.attr('fill', '#000');
            } else if (d.status === 'iniziato') {
              d.status = 'richiesto';
            } else if (d.status === 'richiesto') {
              d.status = 'non_iniziato';
            } else {
              showModal("Il task è già nello stato iniziale.");
              return;
            }

            g.select('rect').attr('fill', statusColors[d.status]);
            updateTaskStatus(d.id, d.status);
          });
      });

    const minY = d3.min(data, d => d.y + taskHeight / 2 + 20);
    const maxY = d3.max(data, d => d.y + taskHeight / 2 + 50);
    const labelBackgroundWidth = 330;

    const labelBackground = svg.append('rect')
      .attr('class', 'label-background')
      .attr('x', 0)
      .attr('y', minY - 20)
      .attr('height', maxY - minY + 40)
      .attr('width', labelBackgroundWidth)
      .attr('fill', 'white')
      .attr('rx', 10)
      .attr('opacity', 0.8);

    const labels = svg.selectAll('.label')
      .data(data)
      .enter()
      .append('text')
      .classed('label', true)
      .attr('font-weight', 'bold')
      .attr('x', 10)
      .attr('y', d => d.y + taskHeight / 2 + 30)
      .text(d => d.name)
      .attr('font-size', '18px');

    window.addEventListener('scroll', () => {
      const scrollX = window.scrollX || window.pageXOffset;
      labels.attr('x', 10 + scrollX);
      labelBackground.attr('x', scrollX);
    });

    function updateTaskStatus(id, status) {
      window.api.updateTask({ id, status })
        .then(res => {
          if (res.changes === 0) showModal("Errore nell'aggiornamento dello stato del task.");
        });
    }
  });
}