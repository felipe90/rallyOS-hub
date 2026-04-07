"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MatchEngine = exports.INITIAL_CONFIG = void 0;
exports.INITIAL_CONFIG = {
    pointsPerSet: 11,
    bestOf: 3,
    minDifference: 2,
};
class MatchEngine {
    constructor(config = {}) {
        this.state = this.getInitialState({ ...exports.INITIAL_CONFIG, ...config });
    }
    getInitialState(config) {
        // Apply handicap as initial score if provided
        const initialScoreA = config.initialScore?.a || config.handicapA || 0;
        const initialScoreB = config.initialScore?.b || config.handicapB || 0;
        return {
            config,
            score: {
                sets: { a: 0, b: 0 },
                currentSet: {
                    a: initialScoreA,
                    b: initialScoreB
                },
                serving: config.initialServer || 'A',
            },
            swappedSides: false,
            midSetSwapped: false,
            setHistory: [],
            status: 'WAITING',
            winner: null,
            tableId: '',
            tableName: '',
            playerNames: { a: 'Player A', b: 'Player B' },
            history: [],
            undoAvailable: false,
        };
    }
    setEventCallback(cb) {
        this.onMatchEvent = cb;
    }
    setPlayerNames(names) {
        this.state.playerNames = names;
        return this.getState();
    }
    setTableId(id, name) {
        this.state.tableId = id;
        this.state.tableName = name;
    }
    addToHistory(player, action, pointsBefore, pointsAfter, setNumber) {
        this.state.history.push({
            id: crypto.randomUUID(),
            player,
            action,
            pointsBefore: JSON.parse(JSON.stringify(pointsBefore)),
            pointsAfter: JSON.parse(JSON.stringify(pointsAfter)),
            setNumber,
            timestamp: Date.now(),
        });
        if (this.state.history.length > 20) {
            this.state.history.shift();
        }
        this.state.undoAvailable = this.state.history.length > 0;
    }
    canUndo() {
        return this.state.history.length > 0 && this.state.status === 'LIVE';
    }
    undoLast() {
        const lastChange = this.state.history.pop();
        this.state.score.currentSet = { ...lastChange.pointsBefore };
        this.updateServing();
        this.state.undoAvailable = this.state.history.length > 0;
        return this.getState();
    }
    startMatch() {
        this.state.status = 'LIVE';
        return this.getState();
    }
    recordPoint(player) {
        if (this.state.status !== 'LIVE')
            return this.getState();
        const pointsBefore = { ...this.state.score.currentSet };
        if (player === 'A')
            this.state.score.currentSet.a++;
        else
            this.state.score.currentSet.b++;
        this.addToHistory(player, 'POINT', pointsBefore, { ...this.state.score.currentSet });
        this.checkSideSwap();
        this.checkSetWin();
        this.updateServing();
        return this.getState();
    }
    checkSideSwap() {
        const { a, b } = this.state.score.sets;
        const isFinalSet = (a + b) === (this.state.config.bestOf - 1);
        if (isFinalSet && !this.state.midSetSwapped) {
            const { a: scoreA, b: scoreB } = this.state.score.currentSet;
            if (scoreA >= 5 || scoreB >= 5) {
                this.state.swappedSides = !this.state.swappedSides;
                this.state.midSetSwapped = true;
                console.log('[Match] Decisive set midpoint reached: Swapping sides');
            }
        }
    }
    subtractPoint(player) {
        if (this.state.status !== 'LIVE')
            return this.getState();
        const p = player.toLowerCase();
        if (this.state.score.currentSet[p] <= 0) {
            return this.getState();
        }
        const pointsBefore = { ...this.state.score.currentSet };
        this.state.score.currentSet[p]--;
        this.addToHistory(player, 'CORRECTION', pointsBefore, { ...this.state.score.currentSet });
        this.updateServing();
        return this.getState();
    }
    updateServing() {
        const totalPoints = this.state.score.currentSet.a + this.state.score.currentSet.b;
        const isDeuce = this.state.score.currentSet.a >= 10 && this.state.score.currentSet.b >= 10;
        const changeInterval = isDeuce ? 1 : 2;
        if (totalPoints % changeInterval === 0) {
            this.state.score.serving = this.state.score.serving === 'A' ? 'B' : 'A';
        }
    }
    checkSetWin() {
        const { a, b } = this.state.score.currentSet;
        const { pointsPerSet, minDifference } = this.state.config;
        const hasReachedLimit = a >= pointsPerSet || b >= pointsPerSet;
        const hasDifference = Math.abs(a - b) >= minDifference;
        if (hasReachedLimit && hasDifference) {
            const winner = a > b ? 'A' : 'B';
            if (winner === 'A')
                this.state.score.sets.a++;
            else
                this.state.score.sets.b++;
            this.state.setHistory.push({ a, b });
            // Record SET_WON in history
            const setNumber = this.state.score.sets.a + this.state.score.sets.b;
            this.addToHistory(winner, 'SET_WON', { a, b }, { a, b }, setNumber);
            if (this.onMatchEvent) {
                const setNumber = this.state.score.sets.a + this.state.score.sets.b;
                const event = {
                    type: 'SET_WON',
                    winner,
                    score: { a, b },
                    setNumber
                };
                this.onMatchEvent(event);
            }
            this.checkMatchWin();
            if (this.state.status !== 'FINISHED') {
                this.state.score.currentSet = { a: 0, b: 0 };
            }
            if (this.state.status !== 'FINISHED') {
                const oldSide = this.state.swappedSides;
                this.state.swappedSides = !this.state.swappedSides;
                this.state.midSetSwapped = false;
                console.log(`[Match] Set finished. Swapping sides for next set: ${oldSide} -> ${this.state.swappedSides}`);
            }
            else {
                console.log(`[Match] Match finished. Keeping sides as is.`);
            }
        }
    }
    checkMatchWin() {
        const { a, b } = this.state.score.sets;
        const setsNeeded = Math.ceil(this.state.config.bestOf / 2);
        if (a >= setsNeeded) {
            this.state.status = 'FINISHED';
            this.state.winner = 'A';
        }
        else if (b >= setsNeeded) {
            this.state.status = 'FINISHED';
            this.state.winner = 'B';
        }
        if (this.state.status === 'FINISHED' && this.onMatchEvent) {
            const event = {
                type: 'MATCH_WON',
                winner: this.state.winner,
                finalScore: [...this.state.setHistory, { a: this.state.score.currentSet.a, b: this.state.score.currentSet.b }],
                sets: { ...this.state.score.sets }
            };
            this.onMatchEvent(event);
        }
    }
    setServer(player) {
        this.state.score.serving = player;
        return this.getState();
    }
    getState() {
        return {
            ...JSON.parse(JSON.stringify(this.state)),
            tableId: this.state.tableId || '',
            tableName: this.state.tableName || '',
            playerNames: this.state.playerNames || { a: 'Player A', b: 'Player B' },
            history: this.state.history,
            undoAvailable: this.state.undoAvailable
        };
    }
}
exports.MatchEngine = MatchEngine;
