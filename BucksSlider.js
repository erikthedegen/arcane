const { useState, useEffect, useCallback } = React;
const { ChevronLeft, Minus, Plus } = lucide;

const BucksSlider = ({ baseStrength = 6, maxBucks = 12, onSubmit, onCancel }) => {
  const [selectedBucks, setSelectedBucks] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  
  // Calculate total strength based on base strength and selected bucks
  const totalStrength = baseStrength + (selectedBucks * baseStrength);

  const handleBucksChange = useCallback((newValue) => {
    if (newValue >= 0 && newValue <= maxBucks) {
      setSelectedBucks(newValue);
    }
  }, [maxBucks]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging) return;
    
    const slider = document.getElementById('bucks-container');
    if (!slider) return;
    
    const bounds = slider.getBoundingClientRect();
    const x = e.clientX - bounds.left;
    const bucksWidth = bounds.width / maxBucks;
    let newBucks = Math.floor(x / bucksWidth);
    newBucks = Math.max(0, Math.min(newBucks, maxBucks));
    
    handleBucksChange(newBucks);
  }, [isDragging, maxBucks, handleBucksChange]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', () => setIsDragging(false));
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isDragging, handleMouseMove]);

  return React.createElement('div', {
    className: 'bg-gray-900 p-4 rounded-lg shadow-lg',
    style: {
      width: '384px',
      backgroundColor: '#111827',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
    }
  }, [
    // Top row with minus, bucks icons, and plus
    React.createElement('div', {
      key: 'top-row',
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px'
      }
    }, [
      // Minus button
      React.createElement('button', {
        key: 'minus',
        onClick: () => handleBucksChange(selectedBucks - 1),
        style: {
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1F2937',
          borderRadius: '9999px',
          color: 'white',
          cursor: 'pointer'
        }
      }, React.createElement(Minus, { size: 20 })),

      // Bucks container
      React.createElement('div', {
        key: 'bucks',
        id: 'bucks-container',
        style: {
          display: 'flex',
          margin: '0 8px',
          position: 'relative',
          cursor: 'pointer'
        },
        onMouseDown: () => setIsDragging(true)
      }, Array.from({ length: maxBucks }).map((_, i) => 
        React.createElement('img', {
          key: i,
          src: 'bucksicon.png',
          alt: 'buck',
          style: {
            width: '32px',
            height: '32px',
            marginLeft: i === 0 ? '0' : '-8px',
            transform: 'rotate(-15deg)',
            opacity: i < selectedBucks ? '1' : '0.3',
            transition: 'opacity 0.2s'
          }
        })
      )),

      // Plus button
      React.createElement('button', {
        key: 'plus',
        onClick: () => handleBucksChange(selectedBucks + 1),
        style: {
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1F2937',
          borderRadius: '9999px',
          color: 'white',
          cursor: 'pointer'
        }
      }, React.createElement(Plus, { size: 20 }))
    ]),

    // Bottom row with back arrow, attack counter, and fight button
    React.createElement('div', {
      key: 'bottom-row',
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '8px'
      }
    }, [
      // Back arrow
      React.createElement('button', {
        key: 'back',
        onClick: onCancel,
        style: {
          width: '32px',
          height: '32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1F2937',
          borderRadius: '9999px',
          color: 'white',
          cursor: 'pointer'
        }
      }, React.createElement(ChevronLeft, { size: 20 })),

      // Attack counter and fight button container
      React.createElement('div', {
        key: 'actions',
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '16px'
        }
      }, [
        // Attack counter
        React.createElement('div', {
          key: 'counter',
          style: {
            padding: '4px 16px',
            backgroundColor: '#1F2937',
            borderRadius: '4px',
            color: '#60A5FA',
            fontWeight: 'bold'
          }
        }, [
          'ATTACK ',
          React.createElement('span', {
            key: 'value',
            style: { color: 'white' }
          }, totalStrength)
        ]),

        // Fight button
        React.createElement('button', {
          key: 'fight',
          onClick: () => onSubmit(selectedBucks),
          style: {
            padding: '4px 24px',
            backgroundColor: '#EAB308',
            color: 'black',
            borderRadius: '4px',
            fontWeight: 'bold',
            cursor: 'pointer'
          }
        }, 'FIGHT')
      ])
    ])
  ]);
};