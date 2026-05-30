import { useState, useEffect, useRef, MouseEvent, FormEvent } from 'react';
import { 
  Users, 
  User, 
  Crown, 
  Clock, 
  Zap, 
  Award, 
  Play, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  Send,
  Pickaxe,
  TrendingUp,
  Sparkles,
  HelpCircle,
  Gem,
  Coins,
  Compass,
  ArrowRight,
  UserCheck,
  Flame
} from 'lucide-react';
import { P2PManager } from './network';
import { PlayerState, GameEventLog, GameStatus, UpgradesState } from './types';

// Audio Synthesizer Engine using Web Audio API (zero external assets required!)
class SoundFX {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playClick() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(320, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.09);
  }

  public playCrit() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const noise = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, this.ctx.currentTime + 0.15);

    noise.type = 'sine';
    noise.frequency.setValueAtTime(650, this.ctx.currentTime);

    gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.2);

    osc.connect(gain);
    noise.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    noise.start();
    osc.stop(this.ctx.currentTime + 0.2);
    noise.stop(this.ctx.currentTime + 0.2);
  }

  public playUpgrade() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Play a rising chime arpeggio
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.005, start + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playNote(261.63, now, 0.1); // C4
    playNote(329.63, now + 0.05, 0.1); // E4
    playNote(392.00, now + 0.10, 0.1); // G4
    playNote(523.25, now + 0.15, 0.25); // C5
  }

  public playLucky() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Dreamy sci-fi sound
    const playNote = (freq: number, start: number, duration: number) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.12, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.connect(gain);
      gain.connect(this.ctx!.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playNote(523.25, now, 0.15); // C5
    playNote(659.25, now + 0.1, 0.15); // E5
    playNote(783.99, now + 0.2, 0.15); // G5
    playNote(1046.50, now + 0.3, 0.3); // C6
  }

  public playAlert() {
    if (this.muted) return;
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, this.ctx.currentTime);
    osc.frequency.setValueAtTime(110, this.ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.35);
  }
}

// Instantiate Sound Manager
const sound = new SoundFX();

export default function App() {
  // P2P / Host-Client State
  const [networkManager, setNetworkManager] = useState<P2PManager | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [p2pRole, setP2pRole] = useState<'NONE' | 'HOST' | 'CLIENT'>('NONE');
  const [playerName, setPlayerName] = useState<string>('');
  const [roomPin, setRoomPin] = useState<string>('');
  const [lobbyPin, setLobbyPin] = useState<string>(''); // Created room PIN
  const [connectionError, setConnectionError] = useState<string>('');
  
  // Game Play Values
  const [score, setScore] = useState<number>(0);
  const [clicks, setClicks] = useState<number>(0);
  const [clickPower, setClickPower] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Upgrade counts
  const [upgrades, setUpgrades] = useState<UpgradesState>({
    baseLevel: 0,
    randomLevel: 0,
    autoDrillLevel: 0,
    critLevel: 0,
    magnetLevel: 0
  });

  // Floating effects
  const [clickParticles, setClickParticles] = useState<{ id: number; x: number; y: number; text: string; type: 'normal' | 'crit' | 'lucky' }[]>([]);
  const particleIdCounter = useRef<number>(0);

  // Lucky Stone State
  const [isLuckyStoneActive, setIsLuckyStoneActive] = useState<boolean>(false);
  const [luckyStonePos, setLuckyStonePos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const luckyStoneTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Shared Global Multiplayer States (Merged in Host, broadcasted to clients)
  const [gameStatus, setGameStatus] = useState<GameStatus>('WAITING');
  const [gameTimer, setGameTimer] = useState<number>(300); // 5 minutes (300 secs)
  const [allPlayers, setAllPlayers] = useState<PlayerState[]>([]);
  const [gameEventLogs, setGameEventLogs] = useState<GameEventLog[]>([]);
  const [chatMessage, setChatMessage] = useState<string>('');

  // Refs for state caching to avoid closures inside websocket callbacks
  const scoreRef = useRef<number>(0);
  const clicksRef = useRef<number>(0);
  const clickPowerRef = useRef<number>(1);
  const upgradesRef = useRef<UpgradesState>(upgrades);

  // Initialize random default name
  useEffect(() => {
    const randomAdjective = ['용감한', '성실한', '황금빛', '우주의', '전설의', '빛나는', '신비한', '미지의', '무적의', '기운찬'];
    const randomNoun = ['광부', '드워프', '드릴러', '고블린', '바위', '결정체', '자본가', '채굴선장', '거구', '강철가면'];
    const rName = `${randomAdjective[Math.floor(Math.random() * randomAdjective.length)]} ${randomNoun[Math.floor(Math.random() * randomNoun.length)]}`;
    setPlayerName(rName);
  }, []);

  // Update refs on changes
  useEffect(() => { scoreRef.current = score; }, [score]);
  useEffect(() => { clicksRef.current = clicks; }, [clicks]);
  useEffect(() => { clickPowerRef.current = clickPower; }, [clickPower]);
  useEffect(() => { upgradesRef.current = upgrades; }, [upgrades]);

  // Audio Toggle
  const toggleMute = () => {
    sound.muted = !sound.muted;
    setIsMuted(sound.muted);
  };

  /**
   * P2P Setup: Start Host Room
   */
  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      alert('광부 이름을 입력해주세요!');
      return;
    }
    
    setIsConnecting(true);
    setConnectionError('');
    const manager = new P2PManager(playerName);
    
    try {
      const pin = await manager.startHost();
      
      // Initialize self as the host player
      const initialHostPlayer: PlayerState = {
        id: manager.myId,
        name: playerName,
        score: 0,
        clicks: 0,
        clickValue: 1,
        upgrades: { baseLevel: 0, randomLevel: 0, autoDrillLevel: 0, critLevel: 0, magnetLevel: 0 },
        hasLuckyStone: false,
        lastActive: Date.now(),
        isHost: true
      };

      setAllPlayers([initialHostPlayer]);
      setNetworkManager(manager);
      setP2pRole('HOST');
      setLobbyPin(pin);
      setIsPlaying(true);
      
      addEventLog('SYSTEM', `${playerName}(방장)님이 채굴장에 입장하여 [방 코드: ${pin}]을 개설했습니다!`, 'join');
      sound.playUpgrade();
      registerNetworkCallbacks(manager, initialHostPlayer.id);

    } catch (err: any) {
      console.error(err);
      setConnectionError('P2P 망 초기화에 실패하였습니다. 다시 시도해 주세요.');
      sound.playAlert();
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * P2P Setup: Join Existing Host Room
   */
  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      alert('광부 이름을 입력해주세요!');
      return;
    }
    if (!roomPin.trim()) {
      alert('입장할 5자리 방 코드를 입력해주세요!');
      return;
    }

    setIsConnecting(true);
    setConnectionError('');
    const manager = new P2PManager(playerName);

    try {
      const success = await manager.joinRoom(roomPin.trim());
      if (success) {
        setNetworkManager(manager);
        setP2pRole('CLIENT');
        setLobbyPin(roomPin.trim());
        setIsPlaying(true);
        sound.playUpgrade();
        registerNetworkCallbacks(manager, manager.myId);
      }
    } catch (err: any) {
      console.error(err);
      setConnectionError('방 참가에 실패했습니다. 코드가 맞는지 확인해 주세요.');
      sound.playAlert();
    } finally {
      setIsConnecting(false);
    }
  };

  /**
   * Broadcast state from HOST to everyone
   */
  const broadcastGameState = (currentPlayers: PlayerState[], overrideStatus?: GameStatus, overrideTimer?: number) => {
    if (!networkManager || !networkManager.isHost) return;

    networkManager.broadcast({
      type: 'GAME_STATE',
      senderId: networkManager.myId,
      senderName: networkManager.myName,
      payload: {
        players: currentPlayers,
        status: overrideStatus || gameStatus,
        timer: overrideTimer !== undefined ? overrideTimer : gameTimer,
        eventLogs: gameEventLogs
      }
    });
  };

  /**
   * Register PeerJS Message Routing / Handlers
   */
  const registerNetworkCallbacks = (manager: P2PManager, myId: string) => {
    
    // Message Received
    manager.onMessageReceived((msg) => {
      switch (msg.type) {
        
        case 'JOIN':
          if (manager.isHost) {
            // Add client to player array
            setAllPlayers((prev) => {
              const alreadyExists = prev.some(p => p.id === msg.senderId);
              if (alreadyExists) return prev;

              const newPlayer: PlayerState = {
                id: msg.senderId,
                name: msg.senderName,
                score: 0,
                clicks: 0,
                clickValue: 1,
                upgrades: { baseLevel: 0, randomLevel: 0, autoDrillLevel: 0, critLevel: 0, magnetLevel: 0 },
                hasLuckyStone: false,
                lastActive: Date.now(),
                isHost: false
              };
              
              const updated = [...prev, newPlayer];
              
              // Push event log & broad to everyone
              setTimeout(() => {
                addEventLog('SYSTEM', ` miners [${msg.senderName}] 님이 채굴 리그에 접속했습니다!`, 'join');
              }, 50);

              return updated;
            });
            sound.playUpgrade();
          }
          break;

        case 'PLAYER_UPDATE':
          if (manager.isHost) {
            setAllPlayers((prev) => {
              const updated = prev.map((p) => {
                if (p.id === msg.senderId) {
                  return {
                    ...p,
                    score: msg.payload.score,
                    clicks: msg.payload.clicks,
                    clickValue: msg.payload.clickValue,
                    upgrades: msg.payload.upgrades,
                    hasLuckyStone: msg.payload.hasLuckyStone,
                    lastActive: Date.now()
                  };
                }
                return p;
              });
              // Send latest matrix to all connected nodes
              return updated;
            });
          }
          break;

        case 'GAME_STATE':
          if (!manager.isHost) {
            // Update client UI with authoritative values from Host
            const state = msg.payload;
            setGameStatus(state.status);
            setGameTimer(state.timer);
            setGameEventLogs(state.eventLogs);
            
            // Extract my state or sync other players
            const updatedPlayers = state.players as PlayerState[];
            setAllPlayers(updatedPlayers);

            const me = updatedPlayers.find(p => p.id === myId);
            if (me) {
              // Reconcile if slightly off / apply server updates
              // But keep score since client is active
            }
          }
          break;

        case 'START_GAME':
          if (!manager.isHost) {
            setGameStatus('PLAYING');
            setScore(0);
            setClicks(0);
            setClickPower(1);
            setUpgrades({
              baseLevel: 0,
              randomLevel: 0,
              autoDrillLevel: 0,
              critLevel: 0,
              magnetLevel: 0
            });
            setIsLuckyStoneActive(false);
            sound.playUpgrade();
          }
          break;

        case 'RESET_GAME':
          if (!manager.isHost) {
            setGameStatus('WAITING');
            setScore(0);
            setClicks(0);
            setClickPower(1);
            setUpgrades({
              baseLevel: 0,
              randomLevel: 0,
              autoDrillLevel: 0,
              critLevel: 0,
              magnetLevel: 0
            });
            setIsLuckyStoneActive(false);
            sound.playAlert();
          }
          break;

        case 'CHAT':
          sound.playClick();
          setGameEventLogs((prev) => {
            const newLog: GameEventLog = {
              id: Math.random().toString(),
              timestamp: Date.now(),
              playerName: msg.senderName,
              message: msg.payload.text,
              type: 'chat'
            };
            return [...prev.slice(-39), newLog];
          });
          break;

        case 'EVENT_LOG':
          const logData = msg.payload as GameEventLog;
          setGameEventLogs((prev) => [...prev.slice(-39), logData]);
          if (logData.type === 'lucky') {
            sound.playLucky();
          }
          break;
      }
    });

    // Handle Disconnect
    manager.onDisconnect((disconnectedPeerId) => {
      // Find player with that connection or peer name
      setAllPlayers((prev) => {
        const found = prev.find(p => p.id === disconnectedPeerId);
        if (found) {
          addEventLog('SYSTEM', `${found.name} 님이 통신망에서 나갔습니다.`, 'chat');
        }
        return prev.filter(p => p.id !== disconnectedPeerId);
      });
    });

    manager.onError((err) => {
      console.error('Peer networking error:', err);
    });
  };

  /**
   * Helper to write logs (HOST broadcasts, clients store local or append)
   */
  const addEventLog = (player: string, text: string, type: GameEventLog['type']) => {
    const newLog: GameEventLog = {
      id: Math.random().toString(),
      timestamp: Date.now(),
      playerName: player,
      message: text,
      type
    };

    setGameEventLogs((prev) => {
      const updated = [...prev.slice(-39), newLog];
      return updated;
    });

    // If host, distribute log directly
    if (networkManager && networkManager.isHost) {
      networkManager.broadcast({
        type: 'EVENT_LOG',
        senderId: networkManager.myId,
        senderName: networkManager.myName,
        payload: newLog
      });
    }
  };

  /**
   * Host-Initiated: State Clock and Auto updates Broadcast
   */
  useEffect(() => {
    if (!networkManager || !networkManager.isHost) return;

    const interval = setInterval(() => {
      setGameTimer((prev) => {
        if (gameStatus === 'PLAYING') {
          if (prev <= 1) {
            // End the match!
            setGameStatus('ENDED');
            addEventLog('SYSTEM', '⏱️ 5분 제한 시간이 완료되었습니다! 리그가 종료되었습니다.', 'win');
            
            // Final sorting
            setTimeout(() => {
              broadcastGameState(allPlayers, 'ENDED', 0);
            }, 100);
            
            return 0;
          }
          
          const newTime = prev - 1;
          broadcastGameState(allPlayers, 'PLAYING', newTime);
          return newTime;
        } else {
          // Keep broadcasting heartbeat during waiting
          broadcastGameState(allPlayers, gameStatus, prev);
          return prev;
        }
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [networkManager, gameStatus, allPlayers]);

  /**
   * Passive Auto Mining Drills: Increment click score every 1 second
   */
  useEffect(() => {
    if (gameStatus !== 'PLAYING') return;

    const interval = setInterval(() => {
      const drillLevel = upgrades.autoDrillLevel;
      if (drillLevel > 0) {
        const passiveIncome = drillLevel * 2; // Auto clicker gains +2원/level every second
        setScore((prev) => prev + passiveIncome);
        sound.playClick();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStatus, upgrades.autoDrillLevel]);

  /**
   * Client-Sided State Synchronization Heartbeat
   * Pushes latest local scores and levels directly to Host
   */
  useEffect(() => {
    if (!networkManager || networkManager.isHost || gameStatus !== 'PLAYING') return;

    const syncInterval = setInterval(() => {
      networkManager.sendToHost({
        type: 'PLAYER_UPDATE',
        senderId: networkManager.myId,
        senderName: playerName,
        payload: {
          score: score,
          clicks: clicks,
          clickValue: clickPower,
          upgrades: upgrades,
          hasLuckyStone: isLuckyStoneActive
        }
      });
    }, 200);

    return () => clearInterval(syncInterval);
  }, [networkManager, gameStatus, score, clicks, clickPower, upgrades, isLuckyStoneActive]);

  /**
   * Host also needs to synchronize its own states in the global `allPlayers` list
   */
  useEffect(() => {
    if (!networkManager || !networkManager.isHost) return;

    setAllPlayers((prev) => {
      return prev.map((p) => {
        if (p.id === networkManager.myId) {
          return {
            ...p,
            score: score,
            clicks: clicks,
            clickValue: clickPower,
            upgrades: upgrades,
            hasLuckyStone: isLuckyStoneActive,
            lastActive: Date.now()
          };
        }
        return p;
      });
    });
  }, [score, clicks, clickPower, upgrades, isLuckyStoneActive]);

  /**
   * Start 5m Championship (Host initiated)
   */
  const handleStartGame = () => {
    if (!networkManager || !networkManager.isHost) return;

    // Zero out stats for restarting
    setScore(0);
    setClicks(0);
    setClickPower(1);
    setUpgrades({
      baseLevel: 0,
      randomLevel: 0,
      autoDrillLevel: 0,
      critLevel: 0,
      magnetLevel: 0
    });
    setIsLuckyStoneActive(false);

    setGameStatus('PLAYING');
    setGameTimer(300); // 5 minutes

    // Reset everyone else too
    networkManager.broadcast({
      type: 'START_GAME',
      senderId: networkManager.myId,
      senderName: networkManager.myName,
      payload: {}
    });

    // Force zero in all database representation
    setAllPlayers((prev) => {
      return prev.map(p => ({
        ...p,
        score: 0,
        clicks: 0,
        clickValue: 1,
        upgrades: { baseLevel: 0, randomLevel: 0, autoDrillLevel: 0, critLevel: 0, magnetLevel: 0 }
      }));
    });

    addEventLog('SYSTEM', '⛏️ 신나는 5분 무한 채굴 대전이 시작되었습니다! 마구 클릭하세요!', 'win');
    sound.playUpgrade();
  };

  /**
   * Reset / Kick back to lobby (Host initiated)
   */
  const handleResetGame = () => {
    if (!networkManager || !networkManager.isHost) return;

    setGameStatus('WAITING');
    setGameTimer(300);
    setScore(0);
    setClicks(0);
    setClickPower(1);
    setIsLuckyStoneActive(false);
    setUpgrades({
      baseLevel: 0,
      randomLevel: 0,
      autoDrillLevel: 0,
      critLevel: 0,
      magnetLevel: 0
    });

    networkManager.broadcast({
      type: 'RESET_GAME',
      senderId: networkManager.myId,
      senderName: networkManager.myName,
      payload: {}
    });

    setAllPlayers((prev) => prev.map(p => ({
      ...p,
      score: 0,
      clicks: 0,
      clickValue: 1,
      upgrades: { baseLevel: 0, randomLevel: 0, autoDrillLevel: 0, critLevel: 0, magnetLevel: 0 }
    })));

    addEventLog('SYSTEM', '⚙️ 채굴장이 초기화되었습니다. 대기실 상태로 돌아갑니다.', 'chat');
    sound.playAlert();
  };

  /**
   * Action: Hit Mine (Core gameplay)
   */
  const handleMineClick = (e: MouseEvent<HTMLDivElement>) => {
    if (gameStatus !== 'PLAYING') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Critical Chance calculation
    const baseCritChance = 0.05; // 5% base
    const customCritChance = baseCritChance + upgrades.critLevel * 0.03; // +3% per level
    const isCritical = Math.random() < customCritChance;
    
    // Calculate final money yield
    const rawIncome = clickPower;
    const yieldMoney = isCritical ? rawIncome * 3 : rawIncome;

    setScore((prev) => prev + yieldMoney);
    setClicks((prev) => prev + 1);

    // Audio & Particles
    if (isCritical) {
      sound.playCrit();
      spawnClickIndicator(x, y, `💥 CRITICAL x3! +${yieldMoney}원!`, 'crit');
    } else {
      sound.playClick();
      spawnClickIndicator(x, y, `+${yieldMoney}원`, 'normal');
    }

    // Spawn 1% Capital Increment Lucky Stone (황금석)
    // Custom chance: base 1% + 0.5% per level of Magnetizer Upgrade
    const baseStoneChance = 0.01;
    const currentLuckyStoneChance = baseStoneChance + upgrades.magnetLevel * 0.005;

    if (!isLuckyStoneActive && Math.random() < currentLuckyStoneChance) {
      triggerLuckyStoneSpawn();
    }
  };

  /**
   * Spawn Click Floating Score Tracker
   */
  const spawnClickIndicator = (x: number, y: number, text: string, type: 'normal' | 'crit' | 'lucky') => {
    const id = particleIdCounter.current++;
    setClickParticles((prev) => [...prev, { id, x, y, text, type }]);
    
    // Automatically scrub after animation is complete (1s)
    setTimeout(() => {
      setClickParticles((prev) => prev.filter((p) => p.id !== id));
    }, 1000);
  };

  /**
   * Logic: Setup ambient Lucky Golden Stone floating event
   */
  const triggerLuckyStoneSpawn = () => {
    const randomX = 15 + Math.random() * 70; // spawn between 15% to 85% area of center mine
    const randomY = 15 + Math.random() * 70;
    
    setLuckyStonePos({ x: randomX, y: randomY });
    setIsLuckyStoneActive(true);
    sound.playLucky();

    addEventLog('SYSTEM', `✨ [${playerName}]의 채굴 구역에 50% 자본 급증 황금석이 나타났습니다! (10초 카운트)`, 'lucky');

    // Despawn to avoid permanent hanging if ignored
    if (luckyStoneTimerRef.current) clearTimeout(luckyStoneTimerRef.current);
    
    luckyStoneTimerRef.current = setTimeout(() => {
      setIsLuckyStoneActive((prevActive) => {
        if (prevActive) {
          addEventLog('SYSTEM', `☄️ 황금석의 밀도가 약해져 우주 먼지로 흩어졌습니다.`, 'chat');
        }
        return false;
      });
    }, 10000);
  };

  /**
   * Click the Lucky Space Ore
   */
  const handleLuckyStoneClick = (e: MouseEvent) => {
    e.stopPropagation(); // Avoid triggering standard ore click below
    if (!isLuckyStoneActive || gameStatus !== 'PLAYING') return;

    if (luckyStoneTimerRef.current) clearTimeout(luckyStoneTimerRef.current);
    setIsLuckyStoneActive(false);

    // Capital raise: increase asset by 50%
    const currentScore = score;
    const bonus = Math.max(1, Math.floor(currentScore * 0.5));
    
    setScore((prev) => prev + bonus);
    sound.playLucky();

    // Spawn massive numbers
    spawnClickIndicator(e.clientX - e.currentTarget.parentElement!.getBoundingClientRect().left, e.clientY - e.currentTarget.parentElement!.getBoundingClientRect().top, `💎 GOLD BOOST +${bonus}원!`, 'lucky');
    
    addEventLog(playerName, `☄️ 황금석을 강타하여 자산이 50% 급증했습니다! (+${bonus}원 보너스!)`, 'lucky');
  };

  /**
   * Exit game session
   */
  const handleDisconnect = () => {
    if (networkManager) {
      networkManager.disconnect();
    }
    setNetworkManager(null);
    setP2pRole('NONE');
    setGameStatus('WAITING');
    setIsPlaying(false);
    setScore(0);
    setClicks(0);
    setClickPower(1);
    setAllPlayers([]);
    setUpgrades({
      baseLevel: 0,
      randomLevel: 0,
      autoDrillLevel: 0,
      critLevel: 0,
      magnetLevel: 0
    });
  };

  /**
   * Chat trigger
   */
  const handleSendChat = (e: FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !networkManager) return;

    setGameEventLogs((prev) => {
      const log: GameEventLog = {
        id: Math.random().toString(),
        timestamp: Date.now(),
        playerName: playerName,
        message: chatMessage.trim(),
        type: 'chat'
      };
      return [...prev.slice(-39), log];
    });

    const msgContent = chatMessage.trim();
    setChatMessage('');

    if (p2pRole === 'HOST') {
      networkManager.broadcast({
        type: 'CHAT',
        senderId: networkManager.myId,
        senderName: playerName,
        payload: { text: msgContent }
      });
    } else {
      networkManager.sendToHost({
        type: 'CHAT',
        senderId: networkManager.myId,
        senderName: playerName,
        payload: { text: msgContent }
      });
    }
  };

  // Pricing formula definitions
  const getBaseUpgradeCost = (lv: number) => {
    // Starts at 5, grows by 10% each level
    return Math.floor(5 * Math.pow(1.10, lv));
  };

  const getRandomUpgradeCost = (lv: number) => {
    // Cost = Base Upgrade Cost of current level * 10
    const baseCost = getBaseUpgradeCost(upgrades.baseLevel);
    return baseCost * 10;
  };

  const getAutoDrillCost = (lv: number) => {
    // Starts at 40, grows by 15% each level
    return Math.floor(40 * Math.pow(1.15, lv));
  };

  const getCritCost = (lv: number) => {
    // Starts at 100, grows by 20%
    return Math.floor(100 * Math.pow(1.20, lv));
  };

  const getMagnetCost = (lv: number) => {
    // Starts at 250, grows by 30%
    return Math.floor(250 * Math.pow(1.30, lv));
  };

  /**
   * Action: Purchase Upgrades
   */
  const buyBaseUpgrade = () => {
    if (gameStatus !== 'PLAYING') return;
    const cost = getBaseUpgradeCost(upgrades.baseLevel);
    if (score >= cost) {
      setScore((prev) => prev - cost);
      setClickPower((prev) => prev + 1);
      setUpgrades((prev) => ({ ...prev, baseLevel: prev.baseLevel + 1 }));
      
      sound.playUpgrade();
      addEventLog(playerName, `🔨 채굴 도구를 강화했습니다 (기본 파워 +1원)`, 'upgrade');
    } else {
      sound.playAlert();
    }
  };

  const buyRandomUpgrade = () => {
    if (gameStatus !== 'PLAYING') return;
    const cost = getRandomUpgradeCost(upgrades.randomLevel);
    if (score >= cost) {
      setScore((prev) => prev - cost);
      
      // Select random increment between 0 and 20
      const randomPower = Math.floor(Math.random() * 21);
      setClickPower((prev) => prev + randomPower);
      setUpgrades((prev) => ({ ...prev, randomLevel: prev.randomLevel + 1 }));

      sound.playUpgrade();
      addEventLog(playerName, `🎲 양자 합성 강화를 실행하여 무작위 클릭 파워가 +${randomPower}원 대폭 상승했습니다!`, 'upgrade');
    } else {
      sound.playAlert();
    }
  };

  const buyAutoDrill = () => {
    if (gameStatus !== 'PLAYING') return;
    const cost = getAutoDrillCost(upgrades.autoDrillLevel);
    if (score >= cost) {
      setScore((prev) => prev - cost);
      setUpgrades((prev) => ({ ...prev, autoDrillLevel: prev.autoDrillLevel + 1 }));

      sound.playUpgrade();
      addEventLog(playerName, `⚙️ 자동 기어 굴착기를 가동했습니다 (초당 +2원 힉득)`, 'upgrade');
    } else {
      sound.playAlert();
    }
  };

  const buyCritUpgrade = () => {
    if (gameStatus !== 'PLAYING') return;
    const cost = getCritCost(upgrades.critLevel);
    if (score >= cost) {
      setScore((prev) => prev - cost);
      setUpgrades((prev) => ({ ...prev, critLevel: prev.critLevel + 1 }));

      sound.playUpgrade();
      addEventLog(playerName, `⚡ 충격파 에너지를 튜닝했습니다 (크리티컬 확률 +3%)`, 'upgrade');
    } else {
      sound.playAlert();
    }
  };

  const buyMagnetUpgrade = () => {
    if (gameStatus !== 'PLAYING') return;
    const cost = getMagnetCost(upgrades.magnetLevel);
    if (score >= cost) {
      setScore((prev) => prev - cost);
      setUpgrades((prev) => ({ ...prev, magnetLevel: prev.magnetLevel + 1 }));

      sound.playUpgrade();
      addEventLog(playerName, `🧲 황금 탐지기 안테나를 교체했습니다 (황금석 조작 능력 향상)`, 'upgrade');
    } else {
      sound.playAlert();
    }
  };

  // Convert timer seconds to dynamic readable clock layout
  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remaining = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
  };

  // Sort Leaderboard players
  const sortedLeaderboard = [...allPlayers].sort((a, b) => b.score - a.score);
  const topThree = sortedLeaderboard.slice(0, 3);

  return (
    <div className="min-h-screen bg-indigo-950 text-white flex flex-col font-sans transition-all duration-500 selection:bg-amber-400/20 selection:text-amber-300 relative">
      <div className="absolute top-0 left-0 w-full h-full opacity-15 pointer-events-none z-0" style={{ backgroundImage: 'radial-gradient(circle at 20% 30%, #4f46e5 0%, transparent 50%), radial-gradient(circle at 80% 70%, #9333ea 0%, transparent 50%)' }}></div>
      
      {/* 1. INITIAL LANDING & P2P CONNECTION CONFIGURATION SCREEN */}
      {!isPlaying ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 lg:p-12 relative overflow-hidden z-10">
          {/* Ambient Background Grid and glowing stars */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e1b4b_1px,transparent_1px),linear-gradient(to_bottom,#1e1b4b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40"></div>
          
          {/* Neon Star Backdrop */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl animate-pulse-glow"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-fuchsia-500/15 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1.2s' }}></div>

          <div className="max-w-md w-full bg-indigo-900/40 border-2 border-indigo-500 rounded-3xl p-8 backdrop-blur-xl relative z-10 shadow-2xl">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-300 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20 mb-4 animate-bounce-subtle">
                <Pickaxe className="w-8 h-8 text-slate-950" />
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent">
                P2P 우주 채굴 리그
              </h1>
              <p className="text-slate-400 text-xs mt-2 font-mono">
                P2P Mining Championship 5M Clicker
              </p>
              <div className="h-0.5 w-20 bg-amber-500/35 rounded-full mt-4"></div>
            </div>

            <div className="space-y-6">
              {/* Miner Name Input */}
              <div className="space-y-2">
                <label className="text-xs font-black text-indigo-300 tracking-wider uppercase font-mono block">
                  마이크로네임 (광부 서명)
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                  <input
                    type="text"
                    maxLength={16}
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="광부 별칭 입력"
                    className="w-full bg-indigo-950/80 border-2 border-indigo-700/50 focus:border-amber-400 focus:ring-1 focus:ring-indigo-500 rounded-xl py-3 pl-10 pr-4 text-sm font-medium transition-all outline-none text-white placeholder-indigo-400/60"
                  />
                </div>
              </div>

              {/* Action Tabs- Host an arena or join room */}
              <div className="grid grid-cols-1 gap-4 pt-2">
                
                {/* Host a new Lobby */}
                <div className="p-1.5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border-2 border-indigo-500/30">
                  <button
                    onClick={handleCreateRoom}
                    disabled={isConnecting}
                    className="w-full bg-gradient-to-br from-amber-400 to-amber-600 text-indigo-950 border-b-4 border-amber-800 hover:from-amber-300 hover:to-amber-500 font-extrabold text-sm tracking-wide rounded-xl py-3.5 shadow-lg shadow-amber-500/10 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting && p2pRole === 'NONE' ? (
                      <span className="w-5 h-5 rounded-full border-2 border-indigo-950 border-t-transparent animate-spin"></span>
                    ) : (
                      <>
                        <Crown className="w-4 h-4" />
                        새 채굴 경기 방 개설 (가장)
                      </>
                    )}
                  </button>
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t-2 border-indigo-900"></div>
                  <span className="flex-shrink mx-4 text-indigo-300 text-[10px] font-mono tracking-widest uppercase">또는 기존 방 접속</span>
                  <div className="flex-grow border-t-2 border-indigo-900"></div>
                </div>

                {/* Join Existing Room */}
                <div className="space-y-3">
                  <div className="relative">
                    <Compass className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
                    <input
                      type="text"
                      maxLength={5}
                      value={roomPin}
                      onChange={(e) => setRoomPin(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="다섯 자리 방 코드 입력 (예: 58210)"
                      className="w-full bg-indigo-950/80 border-2 border-indigo-700/50 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 rounded-xl py-3 pl-10 pr-4 text-center text-sm font-mono tracking-widest transition-all outline-none text-white placeholder-indigo-400/60"
                    />
                  </div>

                  <button
                    onClick={handleJoinRoom}
                    disabled={isConnecting}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm tracking-wide rounded-xl py-3.5 border-b-4 border-indigo-800 shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isConnecting && p2pRole === 'CLIENT' ? (
                      <span className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        동료 광산 참가하기 (동료)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {connectionError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-xl p-3 text-center font-mono">
                  ⚠️ {connectionError}
                </div>
              )}
            </div>

            {/* Instruction Footer */}
            <div className="mt-8 border-t border-slate-800/80 pt-4 text-center">
              <p className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
                <HelpCircle className="w-3 h-3 text-amber-500/50" />
                이 게임은 P2P PeerJS 통신을 통해 클라우드 서버 없이 참가자의 브라우저를 직접 실시간 연동합니다.
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* 2. CORE GAME ARENA INTERFACE SCREEN */
        <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
          
          {/* Header Bar */}
          <header className="bg-indigo-950/60 backdrop-blur-md border-b-2 border-indigo-900 px-6 py-4 flex items-center justify-between z-20">
            {/* Branding & lobby details */}
            <div className="flex items-center gap-4">
              <div className="bg-emerald-500 px-3.5 py-1.5 rounded-full flex items-center gap-2 border-b-4 border-emerald-700">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                <span className="font-black text-xs uppercase tracking-wider text-white">
                  {p2pRole === 'HOST' ? 'HOST ACTIVE' : 'CLIENT LINKED'}
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black tracking-tight text-white uppercase font-mono">P2P MINING</h2>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${p2pRole === 'HOST' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'}`}>
                    {p2pRole === 'HOST' ? '방장(Host)' : '대원(Client)'}
                  </span>
                </div>
                <p className="text-indigo-300 font-mono text-sm mt-0.5">
                  ID: <span className="font-bold text-amber-400 tracking-wider">MINE-{lobbyPin}</span>
                </p>
              </div>
            </div>

            {/* Timer HUD block */}
            <div className="flex flex-col items-center">
              <div className="text-[10px] text-indigo-400 uppercase font-black tracking-widest">Time Remaining</div>
              <div className="text-3xl lg:text-4xl font-black text-amber-400 drop-shadow-[0_4px_12px_rgba(245,158,11,0.3)] tracking-tight font-mono">
                {formatTimer(gameTimer)}
              </div>
            </div>

            {/* HUD actions & Audio Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="w-10 h-10 rounded-xl bg-indigo-900/60 border-2 border-indigo-700/50 text-indigo-200 hover:text-indigo-50 flex items-center justify-center transition-all"
                title={isMuted ? '음소거 해제' : '음소거'}
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
              </button>

              {/* Host Control Actions */}
              {p2pRole === 'HOST' && (
                <div className="flex items-center gap-2 pl-2 border-l-2 border-indigo-900">
                  {gameStatus === 'WAITING' ? (
                    <button
                      onClick={handleStartGame}
                      className="bg-gradient-to-br from-amber-400 to-amber-600 text-indigo-950 border-b-4 border-amber-800 hover:from-amber-300 hover:to-amber-500 font-black text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer shadow-lg shadow-amber-500/10"
                    >
                      <Play className="w-3.5 h-3.5 fill-indigo-950" />
                      대회 시작
                    </button>
                  ) : (
                    <button
                      onClick={handleResetGame}
                      className="bg-indigo-800 hover:bg-rose-950 hover:text-rose-200 border-2 border-indigo-700 hover:border-rose-900 text-indigo-200 font-black text-xs px-4 py-2.5 rounded-xl transition-all flex items-center gap-1.5 active:scale-95 border-b-4"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      방 초기화
                    </button>
                  )}
                </div>
              )}

              <button
                onClick={handleDisconnect}
                className="text-xs bg-rose-600 hover:bg-rose-500 text-white font-black px-4 py-2.5 rounded-xl border-b-4 border-rose-800 active:scale-95 transition-all shadow-md"
              >
                방 나가기
              </button>
            </div>
          </header>

          {/* Master 3-Grid Workspace Grid */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-indigo-950/20 relative">

            {/* TOP 3 LIVE FLOATING MINIMAP (오른쪽 위의 1, 2, 3위만 수려하게 보임 마스킹) */}
            <div className="absolute top-4 right-4 bg-indigo-900/85 backdrop-blur-md p-4 rounded-2xl border-2 border-indigo-500 w-72 shadow-xl z-30">
              <div className="text-xs text-indigo-300 font-bold uppercase mb-3 flex justify-between items-center border-b border-indigo-700/40 pb-2">
                <span className="flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
                  Rankings
                </span>
                <span className="text-indigo-400 font-mono text-[10px]">Top 3 ({allPlayers.length}명)</span>
              </div>
              <div className="space-y-2">
                {topThree.length === 0 ? (
                  <p className="text-[10px] text-indigo-300/60 text-center py-2">연결된 대원이 없습니다.</p>
                ) : (
                  topThree.map((player, idx) => {
                    const isMe = player.id === (networkManager?.myId || '');
                    let itemStyle = 'bg-indigo-950/40 border border-indigo-900 flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-all';
                    let rankNumStyle = 'font-black text-xs mr-1.5';
                    let valStyle = 'font-mono text-sm';

                    if (idx === 0) {
                      itemStyle = 'bg-indigo-900/40 border-2 border-amber-500/50 flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-all shadow-md';
                      rankNumStyle = 'text-amber-400 font-black';
                      valStyle = 'text-emerald-400 font-mono font-bold';
                    } else if (idx === 1) {
                      itemStyle = 'bg-indigo-950/40 border border-indigo-900/60 opacity-80 flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-all';
                      rankNumStyle = 'text-slate-300 font-black';
                      valStyle = 'text-indigo-200 font-mono font-bold text-xs';
                    } else if (idx === 2) {
                      itemStyle = 'bg-indigo-950/40 border border-indigo-900/60 opacity-60 flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs transition-all';
                      rankNumStyle = 'text-amber-700 font-black';
                      valStyle = 'text-indigo-200 font-mono text-xs';
                    }

                    return (
                      <div key={player.id} className={itemStyle}>
                        <div className="flex items-center gap-2 truncate">
                          <span className={rankNumStyle}>
                            {idx === 0 ? '1st' : idx === 1 ? '2nd' : '3rd'}
                          </span>
                          <span className={`font-bold truncate ${idx === 0 ? 'text-amber-300' : 'text-slate-200'} ${isMe ? 'underline underline-offset-2 decoration-amber-400/50 text-emerald-400' : ''}`}>
                            {player.name} {isMe && '(나)'}
                          </span>
                        </div>
                        <span className={valStyle}>{player.score.toLocaleString()}원</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PANEL A (LEFT): UPGRADES CORE PANEL (lg:col-span-4) */}
            <div className="lg:col-span-4 border-r-4 border-indigo-900 bg-indigo-900/10 overflow-y-auto px-6 py-6 flex flex-col space-y-5 h-full scrollbar-thin">
              <div>
                <h3 className="text-2xl font-black text-white flex items-center gap-2">
                  <span>UPGRADES SHOP</span>
                  <span className="text-amber-500 font-mono text-sm uppercase">Level {upgrades.baseLevel + upgrades.randomLevel}</span>
                </h3>
                <p className="text-xs text-indigo-300 mt-1">
                  클릭 수입과 패시브 드릴을 아카이빙 강화하여 우주 대전에서 압승하세요.
                </p>
              </div>

              {/* Player stats inside upgrade box */}
              <div className="bg-indigo-950 border-2 border-indigo-800/70 rounded-2xl p-4 flex flex-col space-y-3 shadow-xl">
                <p className="text-[10px] font-black font-mono text-indigo-300 uppercase tracking-widest flex items-center gap-1.5 border-b border-indigo-800 pb-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  실시간 연동 수치
                </p>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-indigo-900/45 p-2.5 rounded-xl border border-indigo-850">
                    <span className="text-indigo-400 text-[10px] uppercase font-bold block">클릭 수량</span>
                    <span className="text-white font-mono font-black text-sm">{clicks}회</span>
                  </div>
                  <div className="bg-indigo-900/45 p-2.5 rounded-xl border border-indigo-850">
                    <span className="text-indigo-400 text-[10px] uppercase font-bold block">클릭 공격력</span>
                    <span className="text-amber-400 font-mono font-black text-sm">+{clickPower}원</span>
                  </div>
                  <div className="bg-indigo-900/45 p-2.5 rounded-xl border border-indigo-850">
                    <span className="text-indigo-400 text-[10px] uppercase font-bold block">초당 패시브</span>
                    <span className="text-emerald-400 font-mono font-black text-sm">+{upgrades.autoDrillLevel * 2}원/초</span>
                  </div>
                  <div className="bg-indigo-900/45 p-2.5 rounded-xl border border-indigo-850">
                    <span className="text-indigo-400 text-[10px] uppercase font-bold block">크리티컬 타격</span>
                    <span className="text-rose-400 font-mono font-black text-sm">{5 + upgrades.critLevel * 3}% (x3)</span>
                  </div>
                </div>
              </div>

              {/* List of actions upgrades */}
              <div className="space-y-4">
                
                {/* UPGRADE 1: Base Upgrade */}
                <div className="bg-indigo-800/40 p-4 rounded-2xl border-b-4 border-indigo-950 border border-indigo-700/50 flex flex-col justify-between hover:border-amber-500/20 transition-all group">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                      <Pickaxe className="w-5 h-5 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-emerald-400 tracking-tight group-hover:text-emerald-300 transition-colors">Standard Drill (기본 드릴)</span>
                        <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-400/15 border border-amber-500/30 px-2 py-0.5 rounded">Lv.{upgrades.baseLevel}</span>
                      </div>
                      <p className="text-xs text-indigo-200 mt-1">
                        클릭할 때 지급되는 기본 채굴 가치 고정 <strong className="text-amber-400">+1원</strong> 영구 증가합니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-indigo-900/40">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">Base Power: +1</span>
                    <button
                      onClick={buyBaseUpgrade}
                      disabled={score < getBaseUpgradeCost(upgrades.baseLevel) || gameStatus !== 'PLAYING'}
                      className={`text-xs font-black font-mono px-4 py-2 rounded-xl transition-all ${
                        score >= getBaseUpgradeCost(upgrades.baseLevel) && gameStatus === 'PLAYING'
                          ? 'bg-amber-500 hover:bg-amber-400 text-indigo-950 border-b-4 border-amber-700 cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2'
                          : 'bg-indigo-950 text-indigo-500 border-2 border-dashed border-indigo-800 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      ${getBaseUpgradeCost(upgrades.baseLevel).toLocaleString()}
                    </button>
                  </div>
                </div>

                {/* UPGRADE 2: Random Premium Upgrade */}
                <div className="bg-indigo-800/40 p-4 rounded-2xl border-b-4 border-indigo-950 border border-indigo-700/50 flex flex-col justify-between hover:border-fuchsia-500/20 transition-all group">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform shrink-0">
                      <Sparkles className="w-5 h-5 text-fuchsia-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-fuchsia-400 tracking-tight group-hover:text-fuchsia-300 transition-colors">Chaos Engine (양자 합성)</span>
                        <span className="text-[10px] font-mono font-black text-fuchsia-400 bg-fuchsia-500/15 border border-fuchsia-500/30 px-2 py-0.5 rounded">Lv.{upgrades.randomLevel}</span>
                      </div>
                      <p className="text-xs text-indigo-200 mt-1">
                        클릭 시 지급 돈이 무작위로 <strong className="text-fuchsia-400">0원 ~ 20원</strong> 대폭 상승하는 카오스 충전기입니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-indigo-900/40">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">Chaos Bonus ($0-$20)</span>
                    <button
                      onClick={buyRandomUpgrade}
                      disabled={score < getRandomUpgradeCost(upgrades.randomLevel) || gameStatus !== 'PLAYING'}
                      className={`text-xs font-black font-mono px-4 py-2 rounded-xl transition-all ${
                        score >= getRandomUpgradeCost(upgrades.randomLevel) && gameStatus === 'PLAYING'
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-b-4 border-indigo-800 cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2'
                          : 'bg-indigo-950 text-indigo-500 border-2 border-dashed border-indigo-800 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      ${getRandomUpgradeCost(upgrades.randomLevel).toLocaleString()}
                    </button>
                  </div>
                </div>

                {/* UPGRADE 3: Passive Drill Upgrade */}
                <div className="bg-indigo-800/40 p-4 rounded-2xl border-b-4 border-indigo-950 border border-indigo-700/50 flex flex-col justify-between hover:border-cyan-500/20 transition-all group">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform shrink-0">
                      <Flame className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-cyan-400 tracking-tight group-hover:text-cyan-300 transition-colors">Quantum Automatic Drill</span>
                        <span className="text-[10px] font-mono font-black text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded">Lv.{upgrades.autoDrillLevel}</span>
                      </div>
                      <p className="text-xs text-indigo-200 mt-1">
                        패시브 드릴 가동을 지원해 매초 마다 무조건 수동 조작 없이 <strong className="text-cyan-400">+2원</strong>씩 획득합니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-indigo-900/40">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">Auto Mining: +2/S</span>
                    <button
                      onClick={buyAutoDrill}
                      disabled={score < getAutoDrillCost(upgrades.autoDrillLevel) || gameStatus !== 'PLAYING'}
                      className={`text-xs font-black font-mono px-4 py-2 rounded-xl transition-all ${
                        score >= getAutoDrillCost(upgrades.autoDrillLevel) && gameStatus === 'PLAYING'
                          ? 'bg-amber-500 hover:bg-amber-400 text-indigo-950 border-b-4 border-amber-700 cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2'
                          : 'bg-indigo-950 text-indigo-500 border-2 border-dashed border-indigo-800 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      ${getAutoDrillCost(upgrades.autoDrillLevel).toLocaleString()}
                    </button>
                  </div>
                </div>

                {/* UPGRADE 4: Crit Multiplier */}
                <div className="bg-indigo-800/40 p-4 rounded-2xl border-b-4 border-indigo-950 border border-indigo-700/50 flex flex-col justify-between hover:border-red-500/20 transition-all group">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 group-hover:scale-105 transition-transform shrink-0">
                      <Zap className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-rose-400 tracking-tight group-hover:text-rose-300 transition-colors">Laser Surge Core</span>
                        <span className="text-[10px] font-mono font-black text-rose-400 bg-red-500/15 border border-red-500/30 px-2 py-0.5 rounded">Lv.{upgrades.critLevel}</span>
                      </div>
                      <p className="text-xs text-indigo-200 mt-1">
                        클릭 시 <strong className="text-rose-400">3배 임팩트 크리티컬</strong> 타격이 터질 격발 확률을 <strong className="text-rose-400">+3%p</strong> 늘립니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-indigo-900/40">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">Crit Rate: +3%</span>
                    <button
                      onClick={buyCritUpgrade}
                      disabled={score < getCritCost(upgrades.critLevel) || gameStatus !== 'PLAYING'}
                      className={`text-xs font-black font-mono px-4 py-2 rounded-xl transition-all ${
                        score >= getCritCost(upgrades.critLevel) && gameStatus === 'PLAYING'
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white border-b-4 border-indigo-800 cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2'
                          : 'bg-indigo-950 text-indigo-500 border-2 border-dashed border-indigo-800 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      ${getCritCost(upgrades.critLevel).toLocaleString()}
                    </button>
                  </div>
                </div>

                {/* UPGRADE 5: Golden Magnet */}
                <div className="bg-indigo-800/40 p-4 rounded-2xl border-b-4 border-indigo-950 border border-indigo-700/50 flex flex-col justify-between hover:border-yellow-500/20 transition-all group">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/25 flex items-center justify-center text-yellow-500 group-hover:scale-105 transition-transform shrink-0">
                      <Gem className="w-5 h-5 text-yellow-500" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-black text-sm text-yellow-400 tracking-tight group-hover:text-yellow-300 transition-colors">Golden Ore Attractor</span>
                        <span className="text-[10px] font-mono font-black text-yellow-400 bg-yellow-500/15 border border-yellow-500/30 px-2 py-0.5 rounded">Lv.{upgrades.magnetLevel}</span>
                      </div>
                      <p className="text-xs text-indigo-200 mt-1">
                        자산의 즉시 50%를 증축 폭증해주는 황금 광석 특수물 출몰 빈도를 레벨당 <strong className="text-yellow-400">+0.5%p</strong> 강화시킵니다.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-indigo-900/40">
                    <span className="text-[10px] font-mono text-indigo-400 font-bold uppercase">Golden Rate: +0.5%</span>
                    <button
                      onClick={buyMagnetUpgrade}
                      disabled={score < getMagnetCost(upgrades.magnetLevel) || gameStatus !== 'PLAYING'}
                      className={`text-xs font-black font-mono px-4 py-2 rounded-xl transition-all ${
                        score >= getMagnetCost(upgrades.magnetLevel) && gameStatus === 'PLAYING'
                          ? 'bg-amber-500 hover:bg-amber-400 text-indigo-950 border-b-4 border-amber-700 cursor-pointer shadow-md active:translate-y-[2px] active:border-b-2'
                          : 'bg-indigo-950 text-indigo-500 border-2 border-dashed border-indigo-800 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      ${getMagnetCost(upgrades.magnetLevel).toLocaleString()}
                    </button>
                  </div>
                </div>

              </div>
            </div>            {/* PANEL B (CENTER): THE ACTIVE MINING ORE FIELD (lg:col-span-5) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-between p-6 lg:p-8 border-r-4 border-indigo-900 overflow-hidden relative">
              
              {/* Wallet display HUD */}
              <div className="w-full max-w-sm flex flex-col items-center py-5 bg-indigo-950 border-2 border-indigo-800 rounded-3xl backdrop-blur-md z-10 shadow-xl relative mt-4">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-indigo-100 font-mono text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border-b-2 border-indigo-800">
                  MAIN WALLET DISCOVERY
                </div>
                <span className="text-[10px] font-black tracking-widest font-mono text-indigo-300 uppercase">현재 내 자산</span>
                <h1 className="text-4xl lg:text-5xl font-black text-amber-400 font-mono mt-2 tracking-tight drop-shadow-[0_4px_10px_rgba(245,158,11,0.25)] flex items-center gap-1.5 select-none font-mono">
                  <Coins className="w-8 h-8 text-yellow-400 animate-pulse" />
                  {score.toLocaleString()}<span className="text-lg font-bold text-indigo-300 ml-1">원</span>
                </h1>
                <p className="text-[10px] text-indigo-400 mt-2 font-mono uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Pickaxe className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
                  Efficiency: +{clickPower}원/Click
                </p>
              </div>

              {/* Waiting Room Message if WAITING */}
              {gameStatus === 'WAITING' && (
                <div className="bg-indigo-950 border-2 border-indigo-800 p-6 rounded-3xl flex flex-col items-center text-center max-w-sm z-10 shadow-2xl my-6">
                  <div className="w-14 h-14 rounded-full bg-indigo-900 border-2 border-indigo-700 flex items-center justify-center mb-4 shadow">
                    <Users className="w-6 h-6 text-amber-400 animate-pulse" />
                  </div>
                  <h3 className="text-lg font-extrabold text-white">대원들을 기다리는 중...</h3>
                  <p className="text-xs text-indigo-200 mt-2 leading-relaxed">
                    {p2pRole === 'HOST' 
                      ? '상단의 [방 코드 CODE]를 적대 대원에게 전수해주십시오. 조율이 완료되면 우주의 [대회 시작] 지휘 버튼을 눌러 격전을 개시하세요!' 
                      : '대회 시작 카운트다운 전황을 기다리고 계십니다. 방장님이 경기장을 출범해 줄 때까지 클릭 자산을 점검하십시오.'}
                  </p>
                  
                  {p2pRole === 'HOST' && (
                    <button
                      onClick={handleStartGame}
                      className="mt-6 w-full bg-gradient-to-br from-amber-400 to-amber-600 text-indigo-950 border-b-4 border-amber-800 hover:from-amber-300 hover:to-amber-500 font-black text-xs py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                    >
                      <Play className="w-4 h-4 fill-indigo-950" />
                      대채굴 리그 개시! (Start Game)
                    </button>
                  )}
                </div>
              )}

              {/* ENDED Overlays */}
              {gameStatus === 'ENDED' && (
                <div className="bg-indigo-950 border-2 border-indigo-800 p-6 rounded-3xl flex flex-col items-center text-center max-w-sm z-10 shadow-2xl my-6">
                  <div className="w-14 h-14 rounded-full bg-amber-500/20 border-2 border-amber-500/40 flex items-center justify-center mb-4">
                    <Award className="w-6 h-6 text-amber-300 animate-bounce" />
                  </div>
                  <h3 className="text-lg font-black text-amber-400">채굴 경기 타임오버!</h3>
                  <p className="text-xs text-indigo-200 mt-2 leading-relaxed">
                    제한 시간 5분이 완료되었습니다. 최고 가치 기여 순위를 산출 중에 있습니다. 결과 보드를 탐독해 보십시오!
                  </p>
                  
                  {p2pRole === 'HOST' && (
                    <button
                      onClick={handleStartGame}
                      className="mt-6 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-3 px-6 rounded-xl border-b-4 border-indigo-800 active:scale-95 transition-all shadow-md flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      새 매치로 다시 겨루기
                    </button>
                  )}
                </div>
              )}

              {/* Arena clicker if PLAYING */}
              {gameStatus === 'PLAYING' && (
                <div className="flex-1 w-full flex items-center justify-center relative my-4">
                  
                  {/* Floating Action/Hit Particles Wrapper */}
                  <div className="absolute inset-0 pointer-events-none z-20">
                    {clickParticles.map((pt) => (
                      <span
                        key={pt.id}
                        style={{ left: pt.x, top: pt.y }}
                        className={`absolute font-mono font-black text-base tracking-tight text-center select-none particle-float ${
                          pt.type === 'crit' 
                            ? 'text-rose-400 text-xl drop-shadow-[0_4px_12px_rgba(244,63,94,0.65)]' 
                            : pt.type === 'lucky' 
                            ? 'text-yellow-300 text-2xl font-black drop-shadow-[0_4px_16px_rgba(250,204,21,0.8)]' 
                            : 'text-amber-400'
                        }`}
                      >
                        {pt.text}
                      </span>
                    ))}
                  </div>

                  {/* 1% Lucky Boost Stone (황금석) */}
                  {isLuckyStoneActive && (
                    <div
                      style={{ left: `${luckyStonePos.x}%`, top: `${luckyStonePos.y}%` }}
                      onClick={handleLuckyStoneClick}
                      className="absolute w-24 h-24 cursor-pointer z-35 select-none animate-bounce-subtle transform -translate-x-1/2 -translate-y-1/2 group"
                    >
                      <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-xl group-hover:bg-yellow-400/40 transition-all animate-pulse-glow"></div>
                      <div className="w-full h-full bg-gradient-to-tr from-yellow-600 via-amber-400 to-yellow-350 rounded-2xl border-2 border-yellow-200 rotate-45 shadow-2xl flex items-center justify-center group-hover:scale-110 group-active:scale-95 transition-all text-slate-950">
                        <div className="-rotate-45 font-mono text-[10px] font-black text-center select-none uppercase tracking-widest text-[#5c3e03]">
                          <Gem className="w-5 h-5 mx-auto text-amber-950 animate-spin-slow" />
                          자산 +50%!
                        </div>
                      </div>
                      <span className="absolute -top-6 left-1/2 -translate-x-1/2 font-black font-mono text-[9px] text-yellow-300 bg-indigo-950 border border-yellow-500/60 px-2 py-0.5 rounded-full whitespace-nowrap animate-pulse">
                        황금석 타격 찬스!
                      </span>
                    </div>
                  )}

                  {/* Center Massive Mining Rock */}
                  <div 
                    onClick={handleMineClick}
                    className="relative w-80 h-80 cursor-pointer rounded-full flex items-center justify-center select-none group active:scale-95 transition-all duration-75"
                  >
                    {/* Ring aura glowing grids */}
                    <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 scale-155 animate-spin-slow"></div>
                    <div className="absolute inset-0 rounded-full border border-dashed border-amber-400/25 scale-135 animate-spin-slow" style={{ animationDirection: 'reverse' }}></div>
                    <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-colors animate-pulse-glow"></div>

                    {/* Outer core gold structure */}
                    <div className="absolute inset-4 rounded-full bg-indigo-950 border-4 border-indigo-500/60 flex items-center justify-center shadow-2xl group-hover:border-amber-400 transition-colors">
                      
                      {/* Interactive Mine Core Gem Graphic */}
                      <div className="w-52 h-52 rounded-full bg-gradient-to-tr from-indigo-900 via-slate-950 to-indigo-950 flex flex-col items-center justify-center border-2 border-indigo-400/80 p-6 relative group-hover:scale-[1.03] transition-transform animate-float-mine select-none">
                        
                        {/* Dynamic Core Glow */}
                        <div className="absolute inset-6 bg-indigo-500/10 rounded-full flex items-center justify-center">
                          <Pickaxe className="w-16 h-16 text-indigo-400/35 group-hover:text-amber-400/55 transition-colors" />
                        </div>
                        
                        {/* Golden ores floating on gem surface */}
                        <div className="absolute top-1/4 left-1/4 w-3.5 h-3.5 rounded bg-yellow-500 animate-pulse shadow-md shadow-yellow-500/40"></div>
                        <div className="absolute bottom-1/3 right-1/4 w-2.5 h-2.5 rounded bg-amber-400 animate-pulse shadow-md shadow-yellow-500/40" style={{ animationDelay: '0.4s' }}></div>
                        <div className="absolute top-1/2 right-1/3 w-3 h-3 rounded bg-yellow-600 animate-pulse shadow-md shadow-yellow-400/40" style={{ animationDelay: '0.8s' }}></div>

                        <span className="text-white z-10 text-[10px] uppercase font-black tracking-widest font-mono select-none text-indigo-300 group-hover:text-amber-200">
                          CLICK TO MINE
                        </span>
                        <span className="text-amber-400 font-extrabold z-10 text-xs font-mono tracking-wider mt-1.5 uppercase select-none group-hover:scale-110 transition-transform">
                          광산 가동 터치
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Instructions/Protip on play */}
              <div className="w-full bg-indigo-950/60 border-2 border-indigo-800 p-4 rounded-2xl text-center shadow-md">
                <p className="text-xs text-indigo-200 font-semibold leading-relaxed">
                  {gameStatus === 'PLAYING' 
                    ? '🛠️ 실시간 지침: 1% 확률의 [황금석 오레]는 자산을 즉각 50% 증강시킵니다! 강화 5단계 오레 탐지기로 지배력을 강화하십시오.' 
                    : '⏳ 경기가 시작되기 전까지 타격용 터치 코어는 동격 잠금 처리됩니다. 오른쪽 팀 정보망을 이용해 연합 전략에 임하세요.'}
                </p>
              </div>

            </div>

            {/* PANEL C (RIGHT): GAME EVENT LOGS & REALTIME CHAT (lg:col-span-3) */}
            <div className="lg:col-span-3 bg-indigo-900/10 flex flex-col h-full overflow-hidden p-4 border-l-4 border-indigo-900">
              
              {/* Event Logs header */}
              <div className="border-b border-indigo-800/60 pb-3 mb-3 shrink-0">
                <span className="text-xs font-black text-fuchsia-400 tracking-wider font-mono flex items-center gap-1.5 uppercase">
                  <MessageSquare className="w-4 h-4 text-fuchsia-400" />
                  글로벌 정보망 & 대화
                </span>
                <p className="text-[10px] text-indigo-300 font-semibold mt-1">대원들의 업그레이드 전황 및 채팅 대역</p>
              </div>

              {/* Message Streams view block */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1 scrollbar-thin">
                {gameEventLogs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center text-indigo-400/60 text-xs font-mono">
                    채굴 로그가 비어 있습니다.
                  </div>
                ) : (
                  gameEventLogs.map((log) => {
                    let logStyle = 'bg-indigo-950/45 text-indigo-200 border border-indigo-900/50';
                    let label = `${log.playerName}: `;
                    
                    if (log.playerName === 'SYSTEM') {
                      logStyle = 'bg-indigo-900/60 text-amber-300 border border-amber-500/30 font-semibold';
                      label = '⚙️ [알림] ';
                    } else if (log.type === 'upgrade') {
                      logStyle = 'bg-fuchsia-950/40 text-fuchsia-200 border border-fuchsia-500/20';
                    } else if (log.type === 'lucky') {
                      logStyle = 'bg-emerald-950/40 text-emerald-200 border border-emerald-500/20';
                    } else if (log.type === 'win') {
                      logStyle = 'bg-amber-950/60 text-amber-300 font-bold border-2 border-amber-500/45';
                    }

                    return (
                      <div 
                        key={log.id} 
                        className={`p-2 rounded-xl text-[11px] leading-relaxed break-keep font-mono ${logStyle}`}
                      >
                        <span className="font-bold">{label}</span>
                        <span>{log.message}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Send Form */}
              <form onSubmit={handleSendChat} className="flex gap-1.5 shrink-0">
                <input
                  type="text"
                  maxLength={50}
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="대화 내용 전송..."
                  className="flex-1 bg-indigo-950 border-2 border-indigo-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-indigo-400 outline-none focus:border-amber-500 transition-all font-mono"
                />
                <button
                  type="submit"
                  className="w-9 h-9 bg-amber-500 hover:bg-amber-400 text-indigo-950 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-md shadow-amber-500/10 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

          </div>

          {/* 3. MULTIPLAYER FINAL LEADERBOARD OVERLAY (5분 만료 후 가혹한 최종 평가판) */}
          {gameStatus === 'ENDED' && (
            <div className="absolute inset-0 bg-indigo-950/95 z-50 flex flex-col items-center justify-center p-6 backdrop-blur-lg">
              <div className="max-w-xl w-full bg-indigo-950/40 border-2 border-indigo-500 rounded-3xl p-8 shadow-2xl relative overflow-hidden backdrop-blur-2xl">
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500"></div>
                
                {/* Visual Title */}
                <div className="text-center mb-8">
                  <div className="w-14 h-14 bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-spin-slow">
                    <Crown className="w-8 h-8 text-amber-400" />
                  </div>
                  <h1 className="text-2xl font-black bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 bg-clip-text text-transparent tracking-tight">🏆 리그 최종 집계 명예의 전당</h1>
                  <p className="text-xs text-indigo-300 font-semibold mt-1">가장 뛰어난 자산 형성을 달성한 영광의 마이닝 챔피언</p>
                </div>

                {/* Listing ranks */}
                <div className="space-y-3 mb-8 max-h-[320px] overflow-y-auto pr-1 scrollbar-thin">
                  {sortedLeaderboard.map((player, idx) => {
                    let rankBg = 'bg-indigo-900/20 border border-indigo-950/60';
                    let labelColor = 'text-indigo-200';
                    
                    if (idx === 0) {
                      rankBg = 'bg-amber-500/10 border-2 border-amber-500/50';
                      labelColor = 'text-yellow-300 font-black';
                    } else if (idx === 1) {
                      rankBg = 'bg-slate-500/10 border-2 border-slate-500/45';
                      labelColor = 'text-slate-200 font-bold';
                    } else if (idx === 2) {
                      rankBg = 'bg-amber-900/15 border-2 border-amber-800/40';
                      labelColor = 'text-amber-200 font-bold';
                    }

                    return (
                      <div 
                        key={player.id} 
                        className={`flex items-center justify-between p-4 rounded-2xl transition-all ${rankBg}`}
                      >
                        <div className="flex items-center gap-4 truncate">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center font-mono font-black text-sm shrink-0 ${
                            idx === 0 ? 'bg-amber-400 text-indigo-950 shadow shadow-amber-400/20' :
                            idx === 1 ? 'bg-slate-300 text-indigo-950' :
                            idx === 2 ? 'bg-amber-800 text-amber-100' :
                            'bg-indigo-900 text-indigo-400'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="truncate">
                            <span className={`text-sm block truncate ${labelColor}`}>{player.name}</span>
                            <span className="text-[10px] text-indigo-300/80 font-mono">
                              클릭수: {player.clicks || 0}회 | 강화 누적레벨: {
                                (player.upgrades ? (
                                  player.upgrades.baseLevel + player.upgrades.randomLevel + player.upgrades.autoDrillLevel + player.upgrades.critLevel + player.upgrades.magnetLevel
                                ) : 0)
                              }단계
                            </span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className={`text-lg font-mono font-black ${idx === 0 ? 'text-amber-400' : 'text-indigo-200'}`}>
                            {player.score.toLocaleString()}원
                          </span>
                          <span className="text-[10px] text-indigo-400 block font-mono uppercase tracking-widest font-black">자산 가치</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Primary CTA controls for session reset */}
                <div className="flex items-center gap-3">
                  {p2pRole === 'HOST' ? (
                    <button
                      onClick={handleStartGame}
                      className="flex-1 bg-amber-500 hover:bg-amber-400 text-indigo-950 font-black py-4 rounded-2xl hover:shadow-xl transition-all text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md active:translate-y-1 shadow-amber-500/10"
                    >
                      <RotateCcw className="w-4 h-4" />
                      새 대결 세션 다시 실행 (방장용)
                    </button>
                  ) : (
                    <div className="flex-1 text-center bg-indigo-950 border-2 border-indigo-900 p-4 rounded-2xl text-xs text-indigo-300 font-semibold">
                      방장님이 새로운 경기를 개설/재시작하길 대기 중입니다...
                    </div>
                  )}

                  <button
                    onClick={handleDisconnect}
                    className="bg-indigo-900/40 hover:bg-indigo-800/60 border-2 border-indigo-800 text-indigo-200 font-black px-6 py-4 rounded-2xl transition-all text-xs cursor-pointer active:translate-y-1"
                  >
                    대기소로 이동
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
