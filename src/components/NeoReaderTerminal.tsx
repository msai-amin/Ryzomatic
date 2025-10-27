import React, { useState, useEffect } from 'react';

interface SystemStatus {
  name: string;
  status: string;
  load: string;
  color: string;
  description: string;
}

const NeoReaderTerminal: React.FC = () => {
  const [activeSystem, setActiveSystem] = useState<number>(0);
  const [isBooting, setIsBooting] = useState<boolean>(true);

  console.log('NeoReaderTerminal component is rendering');
  console.log('isBooting state:', isBooting);
  console.log('activeSystem state:', activeSystem);


  const systems: SystemStatus[] = [
    {
      name: "NEURAL_ANALYSIS",
      status: "ONLINE",
      load: "87%",
      color: "#00ff88",
      description: "Cognitive pattern recognition and contextual understanding"
    },
    {
      name: "QUANTUM_PARSE",
      status: "OPTIMAL",
      load: "64%",
      color: "#ff0088",
      description: "Multi-dimensional text decomposition and semantic mapping"
    },
    {
      name: "SYNAPSE_SYNTHESIS",
      status: "STABLE",
      load: "72%",
      color: "#0088ff",
      description: "Knowledge network construction and cross-disciplinary linking"
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsBooting(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="neoreader-terminal min-h-screen bg-black text-green-400 font-mono p-6">
      {/* Debug info */}
      <div className="fixed top-0 right-0 bg-red-500 text-white p-2 text-xs z-50">
        NeoReader Terminal Active
      </div>
      {/* Header */}
      <div className="border-b border-green-400 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-2xl">RYZOME//READER</div>
            <div className="text-green-600 text-sm mt-1">v2.4.7 // ACADEMIC_COGNITIVE_ENGINE</div>
          </div>
          <div className="text-right">
            <div className="text-sm">[SYSTEM_STATUS: ONLINE]</div>
            <div className="text-green-600 text-xs">EST: 2024-10-02</div>
          </div>
        </div>
      </div>

      {/* Terminal Output */}
      <div className="border border-green-400 p-4 mb-6 h-48 overflow-y-auto bg-black">
        {isBooting ? (
          <>
            <div className="text-green-500 text-sm mb-2">&gt; INITIATING BOOT SEQUENCE...</div>
            <div className="text-green-400 mb-2">&gt; boot neoreader.core</div>
            <div className="text-green-500 ml-4 mb-2">Initializing cognitive engine...</div>
            <div className="text-green-400 mb-2">&gt; load academic_dataset</div>
            <div className="text-green-500 ml-4 mb-2">Loading 2.4M research documents...</div>
            <div className="text-green-400 mb-2">&gt; start analysis_engine</div>
            <div className="text-green-500 ml-4 mb-2">Neural networks active. Systems nominal.</div>
          </>
        ) : (
          <>
            <div className="text-green-500 mb-4">&gt; SYSTEM_READY. AWAITING_INPUT...</div>
            <div className="text-green-400 mb-2">&gt; status all</div>
            <div className="text-green-500 ml-4 mb-2">All systems operational</div>
            <div className="text-green-400 mb-2">&gt; analyze "academic paper.pdf"</div>
            <div className="text-green-500 ml-4 mb-2">Processing... 87% complete</div>
          </>
        )}
      </div>

      {/* System Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {systems.map((system, index) => (
          <div 
            key={index}
            className={`border p-4 cursor-pointer transition-colors ${
              activeSystem === index 
                ? 'border-green-400' 
                : 'border-green-800 hover:border-green-600'
            }`}
            onClick={() => setActiveSystem(index)}
            style={{ borderColor: activeSystem === index ? system.color : undefined }}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="text-sm" style={{ color: system.color }}>
                {system.name}
              </div>
              <div 
                className="text-xs px-2 py-1 rounded"
                style={{ 
                  backgroundColor: system.color + '20', 
                  color: system.color 
                }}
              >
                {system.status}
              </div>
            </div>
            
            <div className="text-green-600 text-xs mb-2">
              LOAD: {system.load}
            </div>
            
            <div className="text-green-500 text-xs">
              {system.description}
            </div>
          </div>
        ))}
      </div>

      {/* Command Input */}
      <div className="border border-green-400 p-4 mb-6">
        <div className="flex items-center">
          <span className="text-green-400 mr-2">&gt;</span>
          <div className="flex-1">
            <span className="text-green-600">user@neoreader:~$ </span>
            <span className="inline-block w-2 h-4 bg-green-400 animate-pulse"></span>
          </div>
        </div>
        
        <div className="text-green-600 text-xs mt-2">
          Type commands to interact with the system...
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-green-400 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-green-600 text-xs">
          <div>CONNECTED: 47 INSTITUTIONS</div>
          <div>PROCESSED: 2.4M DOCS</div>
          <div>UPTIME: 87 DAYS</div>
        </div>
      </div>
    </div>
  );
};

export default NeoReaderTerminal;
