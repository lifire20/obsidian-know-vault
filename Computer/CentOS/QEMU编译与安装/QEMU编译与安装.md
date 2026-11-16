1. 使用命令
wget [https://download.qemu.org/qemu-4.1.0.tar.xz
下载压缩包](https://download.qemu.org/qemu-4.1.0.tar.xz)。
![[Pasted image 20260401154426.png]]
输入命令
tar xvJf qemu-4.1.0.tar.xz
解压
![[Pasted image 20260401154534.png]]安装
yum install -y gtk2-devel
![[Pasted image 20260401155132.png]]
再安装
yum install -y mesa-libGL-devel mesa-libGLU-devel
![[Pasted image 20260401162444.png]]
执行./configure
进行配置
![[Pasted image 20260401162619.png]]
再执行 make -j 8
进行编译
![[Pasted image 20260401163154.png]]
执行make install
安装
![[Pasted image 20260401163330.png]]
结果
![[Pasted image 20260401163509.png]]
安装地址
![[Pasted image 20260401163614.png]]
