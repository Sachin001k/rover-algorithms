// Dashboard: CSV metrics parsing and bar chart rendering

window.RVSim = window.RVSim || {};

window.RVSim.Dashboard = class {
    static parseCsv(csvText) {
        const lines = csvText.trim().split('\n');
        if (lines.length < 2) {
            throw new Error('CSV file is empty or malformed');
        }

        const header = lines[0].split(',');
        const rows = [];

        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const row = {};
            header.forEach((col, idx) => {
                row[col.trim()] = values[idx]?.trim() || '';
            });
            rows.push(row);
        }

        return { header, rows };
    }

    static aggregateByAlgorithm(rows, metricKey) {
        const byAlgo = {};

        rows.forEach(row => {
            const algo = row.algorithm;
            const value = parseFloat(row[metricKey]);

            if (!isNaN(value)) {
                if (!byAlgo[algo]) {
                    byAlgo[algo] = [];
                }
                byAlgo[algo].push(value);
            }
        });

        // Compute mean for each algorithm
        const result = {};
        Object.keys(byAlgo).forEach(algo => {
            const values = byAlgo[algo];
            const mean = values.reduce((a, b) => a + b, 0) / values.length;
            result[algo] = mean;
        });

        return result;
    }

    static renderBarChart(container, dataMap, title, unit) {
        const chartDiv = document.createElement('div');
        chartDiv.className = 'chart-container';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'chart-title';
        titleDiv.textContent = title;
        chartDiv.appendChild(titleDiv);

        const barChart = document.createElement('div');
        barChart.className = 'bar-chart';

        const entries = Object.entries(dataMap);
        const maxValue = Math.max(...entries.map(([_, v]) => v));

        entries.forEach(([algoName, value]) => {
            const barItem = document.createElement('div');
            barItem.className = 'bar-item';

            const bar = document.createElement('div');
            bar.className = 'bar';
            const heightPercent = (value / maxValue) * 100;
            bar.style.height = Math.max(20, heightPercent) + 'px';

            const label = document.createElement('div');
            label.className = 'bar-label';
            label.textContent = algoName;

            const valueDiv = document.createElement('div');
            valueDiv.className = 'bar-value';
            valueDiv.textContent = value.toFixed(1) + (unit ? ' ' + unit : '');

            barItem.appendChild(bar);
            barItem.appendChild(valueDiv);
            barItem.appendChild(label);

            barChart.appendChild(barItem);
        });

        chartDiv.appendChild(barChart);
        container.appendChild(chartDiv);
    }

    static render(container, csvText) {
        container.innerHTML = '';

        try {
            const { rows } = this.parseCsv(csvText);

            if (rows.length === 0) {
                container.innerHTML = '<p style="color: red;">No data rows found in CSV</p>';
                return;
            }

            // Aggregate metrics by algorithm
            const coverageData = this.aggregateByAlgorithm(rows, 'coverage_percent');
            const stepsData = this.aggregateByAlgorithm(rows, 'steps');
            const overlapData = this.aggregateByAlgorithm(rows, 'overlap_ratio');
            const timeData = this.aggregateByAlgorithm(rows, 'cleaning_time_sec');
            const turnsData = this.aggregateByAlgorithm(rows, 'turns');

            // Render charts
            this.renderBarChart(container, coverageData, 'Coverage %', '%');
            this.renderBarChart(container, stepsData, 'Total Steps', 'steps');
            this.renderBarChart(container, overlapData, 'Overlap Ratio', '');
            this.renderBarChart(container, timeData, 'Cleaning Time', 'sec');
            this.renderBarChart(container, turnsData, 'Number of Turns', 'turns');

            // Summary stats
            const summaryDiv = document.createElement('div');
            summaryDiv.style.marginTop = '20px';
            summaryDiv.style.padding = '15px';
            summaryDiv.style.backgroundColor = '#f5f5f5';
            summaryDiv.style.borderRadius = '4px';
            summaryDiv.innerHTML = `
                <strong>Summary:</strong> Analyzed ${rows.length} simulation results
                across ${Object.keys(coverageData).length} algorithms
            `;
            container.appendChild(summaryDiv);
        } catch (err) {
            container.innerHTML = '<p style="color: red;">Error parsing CSV: ' + err.message + '</p>';
        }
    }
};
