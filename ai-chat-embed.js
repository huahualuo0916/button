(function() {
  // 配置参数
  const CHAT_URL = 'http://localhost:5173';//网址
  const BUTTON_SIZE = 64;//按钮大小64*64
  const CONTAINER_PADDING = 10; // 热区容器比按钮大10
  const CONTAINER_SIZE = BUTTON_SIZE + CONTAINER_PADDING * 2; // 热区容器大小
  const VISIBLE_PART = 32;//隐藏一半32
  const IFRAME_WIDTH = 380;//iframe宽
  const IFRAME_HEIGHT = 600;//iframe高
  const SPACING = 64;//iframe侧边距
  const IFRAME_TOP_OFFSET = 60;//iframe顶边距
  const SHOW_ANIM_DURATION = '0.3s';
  const DRAG_THRESHOLD = 5;//超过5px认定为拖拽
  const HIDE_PART_ANIM_DURATION = '0.8s'; // 半隐藏动画时长

  // 工具函数：将动画时间字符串转换为毫秒
  const getMsFromDuration = (durationStr) => {
    return parseFloat(durationStr) * 1000;
  };
  // 样式定义
  const STYLE = {
    container: {
      position: 'fixed',
      width: `${CONTAINER_SIZE}px`,
      height: `${CONTAINER_SIZE}px`,
      backgroundColor: 'rgba(255,100,200,0)', // 热区背景半透明方便观察
      zIndex: '99997', // 确保低于按钮
      pointerEvents: 'auto', // 接收鼠标事件但不影响按钮
    },
    button: {
      position: 'fixed',
      width: `${BUTTON_SIZE}px`,
      height: `${BUTTON_SIZE}px`,
      borderRadius: '50%',
      backgroundColor: '#009ce0', 
      color: 'white',
      border: 'none',
      boxShadow: '0 8px 24px #00000029', 
      cursor: 'pointer',
      fontSize: '24px',
      zIndex: '99999', // 确保高于容器
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transform: 'rotate(0deg)', 
      overflow: 'hidden',
      userSelect: 'none',
      touchAction: 'none',
      transition: 'none'
    },
    buttonHover: {
      // boxShadow: '0 12px 36px #00000066'
      boxShadow:'none'
    },
    buttonActive: {
      transform: 'rotate(-90deg)',
    },
    iframe: {
      position: 'fixed',
      width: `${IFRAME_WIDTH}px`,
      height: '0',
      maxHeight: `${IFRAME_HEIGHT}px`,
      borderRadius: '12px',
      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
      border: 'none',
      zIndex: '99998',
      transition: 'height 0.3s ease, opacity 0.3s ease',
      opacity: 0,
      overflow: 'hidden',
      backgroundColor: 'rgb(255, 255, 255)',
    },
    iframeActive: {
      height: `${IFRAME_HEIGHT}px`,
      opacity: 1
    }
  };
  // 创建热区容器和悬浮按钮
  const createButton = () => {
    // 创建热区容器
    const container = document.createElement('div');
    container.id = 'ai-chat-container';
    // 应用容器样式
    Object.keys(STYLE.container).forEach(key => {
      container.style[key] = STYLE.container[key];
    });
    // 创建按钮
    const button = document.createElement('button');
    button.id = 'ai-chat-button';
    let isDragging = false;
    let isClick = true;
    let startX = null;
    let startY = null;
    let currentSide = 'right';
    let offsetX = 0;
    let offsetY = 0;
    let buttonY = window.innerHeight * 0.8;
    let dragEnded = false; 
    
    // 按钮图标
    button.innerHTML = `
      <span class="icon-default"></span>
      <span class="icon-active">✕</span>
    `;
    
    // 应用按钮基础样式
    Object.keys(STYLE.button).forEach(key => {
      button.style[key] = STYLE.button[key];
    });

    // 初始位置
    updatePositions();

    // 添加样式表
    const style = document.createElement('style');
    style.textContent = `
      #ai-chat-button { position: relative; }

      /* 按钮动画 */
      @keyframes buttonPulse {
        0% { transform: scale(1) rotate(-90deg); }
        50% { transform: scale(0.85) rotate(-45deg); }
        100% { transform: scale(1) rotate(0deg); }
      }
      
      @keyframes buttonPulseActive {
        0% { transform: scale(1) rotate(0deg); }
        50% { transform: scale(0.85) rotate(-45deg); }
        100% { transform: scale(1) rotate(-90deg); }
      }
      
      #ai-chat-button.pulse { animation: buttonPulse 0.2s ease; }
      #ai-chat-button.active.pulse { animation: buttonPulseActive 0.2s ease; }

      /* 图标样式 */
      #ai-chat-button .icon-default {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        transition: opacity 0.3s ease;
        width: 24px;
        height: 24px;
        background-color: white;
        border-radius: 12px 12px 0 12px ;
      }
      
      #ai-chat-button .icon-active {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        transition: opacity 0.3s ease;
        color: white;
        font-weight: bold;
        font-size: 24px;
        line-height: 1;
        margin: 0;
        opacity: 0;
      }
      
      #ai-chat-button.active .icon-default { opacity: 0; }
      #ai-chat-button.active .icon-active { opacity: 1; }

      /* 侧边样式 */
      .hiding-part {
        transition: left ${HIDE_PART_ANIM_DURATION} ease, right ${HIDE_PART_ANIM_DURATION} ease !important;
      }
      .left-side {
        left: 0;
        right: auto;
      }
      .right-side {
        right: 0;
        left: auto;
      }
      .active.left-side {
        left: 0 !important;
        right: auto !important;
      }
      .active.right-side {
        right: 0 !important;
        left: auto !important;
      }

      /* 拖拽时的样式 */
      #ai-chat-button.dragging {
        transition: none !important;
        cursor: grabbing !important;
      }
    `;
    document.head.appendChild(style);
    
    const screenCenter = window.innerWidth / 2;

    // 更新位置
    function updatePositions() {
      const buttonHiddenOffset = BUTTON_SIZE - VISIBLE_PART;
      const buttonLeft = currentSide === 'left' ? `-${buttonHiddenOffset}px` : 'auto';
      const buttonRight = currentSide === 'right' ? `-${buttonHiddenOffset}px` : 'auto';
      
      const containerLeft = currentSide === 'left' 
        ? `-${buttonHiddenOffset - CONTAINER_PADDING}px` 
        : 'auto';
      const containerRight = currentSide === 'right' 
        ? `-${buttonHiddenOffset - CONTAINER_PADDING}px` 
        : 'auto';
      
      const containerTop = `${buttonY - CONTAINER_PADDING}px`;
      
      button.style.left = buttonLeft;
      button.style.right = buttonRight;
      button.style.top = `${buttonY}px`;
      
      container.style.left = containerLeft;
      container.style.right = containerRight;
      container.style.top = containerTop;
    }

    // 更新侧边类名
    const updateSideClass = () => {
      [container, button].forEach(el => {
        el.classList.remove('left-side', 'right-side');
        el.classList.add(`${currentSide}-side`);
      });
    };

    // 完全展现按钮
    const fullyShowButton = () => {
      if (isDragging) return;
      
      [container, button].forEach(el => el.classList.remove('hiding-part'));
      button.style.transition = `all ${SHOW_ANIM_DURATION}`;
      
      Object.keys(STYLE.buttonHover).forEach(key => {
        button.style[key] = STYLE.buttonHover[key];
      });
      
      if (currentSide === 'left') {
        container.style.left = `-${CONTAINER_PADDING}px`;
        container.style.right = 'auto';
        button.style.left = '0px';
        button.style.right = 'auto';
      } else {
        container.style.right = `-${CONTAINER_PADDING}px`;
        container.style.left = 'auto';
        button.style.right = '0px';
        button.style.left = 'auto';
      }
    };

    // 半隐藏动画
    const hidePartially = (side) => {
      [container, button].forEach(el => el.classList.add('hiding-part'));
      
      if (side === 'left') {
        container.style.left = `-${CONTAINER_PADDING}px`;
        container.style.right = 'auto';
        button.style.left = '0px';
        button.style.right = 'auto';
        
        container.offsetHeight;
        button.offsetHeight;
        
        container.style.left = `-${(BUTTON_SIZE - VISIBLE_PART) - CONTAINER_PADDING}px`;
        button.style.left = `-${BUTTON_SIZE - VISIBLE_PART}px`;
      } else {
        container.style.right = `-${CONTAINER_PADDING}px`;
        container.style.left = 'auto';
        button.style.right = '0px';
        button.style.left = 'auto';
        
        container.offsetHeight;
        button.offsetHeight;
        
        container.style.right = `-${(BUTTON_SIZE - VISIBLE_PART) - CONTAINER_PADDING}px`;
        button.style.right = `-${BUTTON_SIZE - VISIBLE_PART}px`;
      }
      
      setTimeout(() => {
        [container, button].forEach(el => el.classList.remove('hiding-part'));
      }, getMsFromDuration(HIDE_PART_ANIM_DURATION));
    };

    // 吸附到边缘
    const snapToEdgeFull = (side, callback) => {
      const rect = button.getBoundingClientRect();
      [container, button].forEach(el => el.classList.add('hiding-part'));

      if (side === 'left') {
        container.style.left = `${rect.left - CONTAINER_PADDING}px`;
        container.style.right = 'auto';
        button.style.left = `${rect.left}px`;
        button.style.right = 'auto';
        
        container.offsetHeight;
        button.offsetHeight;
        
        container.style.left = `-${CONTAINER_PADDING}px`;
        button.style.left = '0px';
      } else {
        container.style.right = `${window.innerWidth - rect.right - CONTAINER_PADDING}px`;
        container.style.left = 'auto';
        button.style.right = `${window.innerWidth - rect.right}px`;
        button.style.left = 'auto';
        
        container.offsetHeight;
        button.offsetHeight;
        
        container.style.right = `-${CONTAINER_PADDING}px`;
        button.style.right = '0px';
      }

      setTimeout(callback, getMsFromDuration(HIDE_PART_ANIM_DURATION));
    };

    // 鼠标移动 - 拖拽中
    const handleMouseMove = (e) => {
      if (button.classList.contains('active') || startX === null) return;
      
      const moveX = Math.abs(e.clientX - startX);
      const moveY = Math.abs(e.clientY - startY);
      
      if (moveX > DRAG_THRESHOLD || moveY > DRAG_THRESHOLD) {
        isDragging = true;
        isClick = false;  
        dragEnded = false;
        button.classList.add('dragging');
        [container, button].forEach(el => el.classList.remove('hiding-part'));
      }
      
      if (isDragging) {
        const newX = e.clientX - offsetX;
        let newY = e.clientY - offsetY;
        const maxY = window.innerHeight - BUTTON_SIZE;
        newY = Math.max(0, Math.min(newY, maxY));
        
        button.style.left = `${newX}px`;
        button.style.top = `${newY}px`;
        button.style.right = 'auto';
        
        container.style.left = `${newX - CONTAINER_PADDING}px`;
        container.style.top = `${newY - CONTAINER_PADDING}px`;
        container.style.right = 'auto';
      }
    };

    // 鼠标释放 - 结束拖拽
    const handleMouseUp = () => {
      if (button.classList.contains('active') || startX === null) {
        cleanupDragEvents();
        return;
      }
      
      button.classList.remove('dragging');
      const wasDragging = isDragging;
      
      
      dragEnded = wasDragging;
      isClick = !wasDragging;  
      
      cleanupDragEvents();
      
      if (wasDragging) {
        const rect = button.getBoundingClientRect();
        const buttonCenterX = rect.left + rect.width / 2;
        currentSide = buttonCenterX < window.innerWidth / 2 ? 'left' : 'right';
        updateSideClass();
        
        buttonY = rect.top;
        
        snapToEdgeFull(currentSide, () => {
          hidePartially(currentSide);
          // 拖拽动画完成后重置状态，但保持点击为false直到下次按下
          setTimeout(() => {
            isDragging = false;
            dragEnded = false;
          }, 100);
        });
      } else {
        // 不是拖拽，恢复点击状态
        isClick = true;
      }
    };

    // 清理拖拽事件
    const cleanupDragEvents = () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
    };

    // 鼠标按下 - 开始拖拽
    const handleMouseDown = (e) => {
      if (button.classList.contains('active') || e.button !== 0) return;
      
      // 按下时重置所有状态
      isDragging = false;
      isClick = true;
      dragEnded = false;
      
      const rect = button.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      
      button.classList.add('dragging');
      [container, button].forEach(el => el.classList.remove('hiding-part'));
      
      container.style.zIndex = '99997';
      button.style.zIndex = '99999';
      
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('mouseup', handleMouseUp, true);
      
      e.stopPropagation();
      e.preventDefault();
    };

    // 点击事件 - 切换聊天窗口（关键修复）
    const handleClick = (e) => {
      // 只有当不是拖拽结束且明确是点击时才触发
      if (!dragEnded && isClick) {
        toggleChat(container, button, currentSide);
      }
      // 无论如何，点击事件后重置状态
      setTimeout(() => {
        isClick = true;
        dragEnded = false;
      }, 100);
      e.stopPropagation();
    };

    // 绑定事件
    button.addEventListener('mousedown', handleMouseDown);
    button.addEventListener('click', handleClick);

    // 容器和按钮的鼠标进入事件
    container.addEventListener('mouseenter', fullyShowButton);
    button.addEventListener('mouseenter', fullyShowButton);

    // 鼠标离开 - 半隐藏
    container.addEventListener('mouseleave', () => {
      if (isDragging || button.classList.contains('active')) {
        return;
      }
      
      Object.keys(STYLE.button).forEach(key => {
        if (!['left', 'right', 'top', 'bottom', 'transition'].includes(key)) {
          button.style[key] = STYLE.button[key];
        }
      });
      
      hidePartially(currentSide);
    });

    // 窗口大小变化时重新定位
    window.addEventListener('resize', () => {
      if (!button.classList.contains('active')) {
        updatePositions();
      }
    });

    // 初始化侧边类名
    updateSideClass();
    document.body.appendChild(container);
    document.body.appendChild(button);
    return { container, button };
  };

  // 创建iframe容器
  const createIframe = () => {
    const iframe = document.createElement('iframe');
    iframe.id = 'ai-chat-iframe';
    iframe.src = CHAT_URL;
    
    Object.keys(STYLE.iframe).forEach(key => {
      iframe.style[key] = STYLE.iframe[key];
    });
    
    document.body.appendChild(iframe);
    return iframe;
  };

  // 切换对话窗口显示/隐藏
  const toggleChat = (container, button, currentSide) => {
    const iframe = document.getElementById('ai-chat-iframe');
    const isActive = button.classList.contains('active');

    button.classList.remove('pulse');
    void button.offsetWidth;
    button.classList.add('pulse');

    if (isActive) {
      // 收起状态
      button.classList.remove('active');
      container.classList.remove('active');
      
      Object.keys(STYLE.button).forEach(key => {
        if (!['left', 'right', 'top', 'bottom', 'transition'].includes(key)) {
          button.style[key] = STYLE.button[key];
        }
      });
      
      Object.keys(STYLE.iframe).forEach(key => {
        iframe.style[key] = STYLE.iframe[key];
      });
      
      button.style.pointerEvents = 'auto';
      
    } else {
      // 展开状态
      button.classList.add('active');
      container.classList.add('active');
      
      Object.keys(STYLE.buttonHover).forEach(key => {
        button.style[key] = STYLE.buttonHover[key];
      });
      Object.keys(STYLE.buttonActive).forEach(key => {
        button.style[key] = STYLE.buttonActive[key];
      });
      
      if (currentSide === 'left') {
        iframe.style.left = `${SPACING}px`;
        iframe.style.right = 'auto';
      } else {
        iframe.style.right = `${SPACING}px`;
        iframe.style.left = 'auto';
      }
      
      iframe.style.top = `${IFRAME_TOP_OFFSET}px`;
      
      Object.keys(STYLE.iframeActive).forEach(key => {
        iframe.style[key] = STYLE.iframeActive[key];
      });
    }

    setTimeout(() => button.classList.remove('pulse'), 300);
  };

  // 初始化
  window.addEventListener('load', () => {
    createButton();
    createIframe();
  });
})();
