import os
import subprocess
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

def generate_pdf_native():
    html_file = Path(__file__).resolve().parents[1] / "CV_MEDFLOW_SHOWCASE.html"
    pdf_file = Path(__file__).resolve().parents[1] / "CV_MEDFLOW_SHOWCASE.pdf"
    
    # Method 1: Use Headless Edge with native Inter / Unicode font rendering
    edge_paths = [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    ]
    for edge in edge_paths:
        if os.path.exists(edge):
            cmd = [
                edge,
                "--headless=new",
                "--disable-gpu",
                "--no-pdf-header-footer",
                f"--print-to-pdf={pdf_file}",
                str(html_file)
            ]
            res = subprocess.run(cmd, capture_output=True)
            if pdf_file.exists() and pdf_file.stat().st_size > 10000:
                print("PDF generated successfully with full Unicode via browser engine:", pdf_file)
                return

    # Method 2: ReportLab with registered Windows Arial TTF (Full Vietnamese support)
    font_path = r"C:\Windows\Fonts\arial.ttf"
    font_bold_path = r"C:\Windows\Fonts\arialbd.ttf"
    
    if os.path.exists(font_path):
        pdfmetrics.registerFont(TTFont('ArialCustom', font_path))
        regular_font = 'ArialCustom'
    else:
        regular_font = 'Helvetica'
        
    if os.path.exists(font_bold_path):
        pdfmetrics.registerFont(TTFont('ArialCustom-Bold', font_bold_path))
        bold_font = 'ArialCustom-Bold'
    else:
        bold_font = 'Helvetica-Bold'

    doc = SimpleDocTemplate(
        str(pdf_file),
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName=bold_font,
        fontSize=15,
        leading=19,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=3
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName=bold_font,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#0284C7'),
        spaceAfter=6
    )
    link_style = ParagraphStyle(
        'LinkStyle',
        parent=styles['Normal'],
        fontName=bold_font,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0369A1'),
    )
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName=bold_font,
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=8,
        spaceAfter=4
    )
    project_title = ParagraphStyle(
        'ProjectTitle',
        parent=styles['Normal'],
        fontName=bold_font,
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#0F172A'),
    )
    role_style = ParagraphStyle(
        'RoleStyle',
        parent=styles['Normal'],
        fontName=bold_font,
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0284C7'),
        spaceAfter=2
    )
    tech_stack = ParagraphStyle(
        'TechStack',
        parent=styles['Normal'],
        fontName=regular_font,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#334155'),
        spaceAfter=4
    )
    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=styles['Normal'],
        fontName=regular_font,
        fontSize=8.5,
        leading=12,
        textColor=colors.HexColor('#1E293B'),
        leftIndent=10,
        firstLineIndent=-10,
        spaceAfter=3
    )

    story = []
    story.append(Paragraph("MEDFLOW — DATA ANALYST CV SHOWCASE (VNPT / VAIC ALIGNED)", title_style))
    story.append(Paragraph("Hospital Queue Intelligence & Operational Analytics Platform", subtitle_style))
    
    links_data = [[
        Paragraph('<a href="https://medflow-frontend-y3e6.onrender.com/login" color="#0284C7"><b>Live Web App</b></a>', link_style),
        Paragraph('<a href="https://medflow-analytics.streamlit.app" color="#047857"><b>Live Streamlit Dashboard</b></a>', link_style),
        Paragraph('<a href="https://github.com/kieuwangtruong/MedFlow" color="#0F172A"><b>GitHub Repository</b></a>', link_style),
    ]]
    link_table = Table(links_data, colWidths=[170, 190, 160])
    link_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(link_table)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284C7'), spaceBefore=2, spaceAfter=4))
    
    # SECTION 1: VIETNAMESE
    story.append(Paragraph("1. BẢN TIẾNG VIỆT (TỐI ƯU ỨNG TUYỂN VNPT & DOANH NGHIỆP TRONG NƯỚC)", section_heading))
    story.append(Paragraph("<b>MEDFLOW – Nền Tảng Phân Tích Dữ Liệu & Tối Ưu Hóa Vận Hành Hàng Đợi Bệnh Viện</b> (VNPT VAIC)", project_title))
    story.append(Paragraph("Vai trò: Data Analyst (Fresher/Junior) | 10/2025 – Hiện tại", role_style))
    story.append(Paragraph("<b>Công nghệ:</b> Python (Pandas, NumPy, SciPy, Streamlit, Plotly), PostgreSQL/Neon, Star Schema (Data Mart), Git.", tech_stack))
    
    story.append(Paragraph("&bull; <b>Data Modeling & Dictionary [MF-01]:</b> Khảo sát nghiệp vụ tiếp đón y tế số (Case study VNPT/VAIC), chuẩn hóa từ điển dữ liệu (Data Dictionary) và thiết kế Data Mart Star Schema (fact_patient_journey, dim_departments) quản lý hơn 10.000+ lượt khám tại 12 chuyên khoa lâm sàng.", bullet_style))
    story.append(Paragraph("&bull; <b>ETL & Data Cleaning Pipeline [MF-02]:</b> Xây dựng pipeline Python (Pandas) tự động xử lý missing values, loại bỏ bản ghi ngoại lai (thời gian chờ âm, service duration > 180 phút) và chuẩn hóa đồng bộ múi giờ từ ISO UTC sang Asia/Ho_Chi_Minh.", bullet_style))
    story.append(Paragraph("&bull; <b>Phân Tích Thống Kê & Điểm Nghẽn Luồng Khám [MF-03]:</b> Ứng dụng SciPy/SQL tính toán các phân vị <b>P50, P80, P90</b> thay thế giá trị trung bình (Mean) bị lệch phải; cô lập và chỉ ra điểm nghẽn nghiêm trọng nhất tại khâu cận lâm sàng/CĐHA với thời gian chờ P80 kéo dài <b>48 phút</b> trong luồng khép kín 3 bước (A &rarr; B &rarr; A': Khám ban đầu &rarr; CLS &rarr; Tái khám).", bullet_style))
    story.append(Paragraph("&bull; <b>Mô Phỏng San Tải & Dashboard Điều Hành [MF-04, MF-05]:</b> Lập trình thuật toán mô phỏng hàng đợi ngẫu nhiên rời rạc (Discrete-Event Simulation) chứng minh giải pháp <i>AI Dynamic Routing</i> giúp <b>giảm 18% – 25% thời gian chờ trung vị (P50)</b> trong khung giờ cao điểm; triển khai Streamlit Dashboard trực quan hóa Heatmap mật độ buồng khám và ma trận cảnh báo vi phạm cam kết SLA y tế theo thời gian thực.", bullet_style))
    
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E2E8F0'), spaceBefore=2, spaceAfter=4))
    
    # SECTION 2: ENGLISH
    story.append(Paragraph("2. ENGLISH RESUME SECTION (ATS-FRIENDLY & US TECH COMPLIANT)", section_heading))
    story.append(Paragraph("<b>MEDFLOW – Hospital Queue Intelligence & Operational Analytics Platform</b> (VAIC Case Study)", project_title))
    story.append(Paragraph("Role: Junior Data Analyst | Oct 2025 – Present", role_style))
    story.append(Paragraph("<b>Tech Stack:</b> Python (Pandas, NumPy, SciPy, Streamlit, Plotly), PostgreSQL/Neon, Star Schema (Data Mart), Git.", tech_stack))
    
    story.append(Paragraph("&bull; <b>Data Understanding & Data Mart Design [MF-01]:</b> Formulated an end-to-end Data Dictionary and designed a Star Schema Data Mart (fact_patient_journey, dim_departments) based on digital outpatient workflows (VNPT/VAIC case study), organizing 10,000+ patient records across 12 clinical departments.", bullet_style))
    story.append(Paragraph("&bull; <b>ETL & Data Preprocessing Pipeline [MF-02]:</b> Engineered an automated Python (Pandas) data cleansing pipeline handling missing values, filtering physiological/log anomalies (negative durations, tasks > 180 mins), and converting UTC timestamps to local timezone (Asia/Ho_Chi_Minh).", bullet_style))
    story.append(Paragraph("&bull; <b>Descriptive & Percentile Bottleneck Analytics [MF-03]:</b> Computed robust statistical percentiles (<b>P50, P80, P90</b> via SciPy/SQL) to overcome right-skewed mean bias; isolated a critical diagnostic turnaround bottleneck of <b>48 minutes (P80 wait)</b> within the closed-loop 3-step pathway (A &rarr; B &rarr; A': Consult &rarr; Lab/Imaging &rarr; Review).", bullet_style))
    story.append(Paragraph("&bull; <b>Discrete-Event Simulation & Operational Dashboard [MF-04, MF-05]:</b> Programmed a discrete-event simulation engine benchmarking routing strategies, quantifying an <b>18% – 25% reduction in median wait time (P50)</b> during peak arrival surges using <i>AI Dynamic Routing</i>; deployed a multi-page interactive Streamlit Control Center visualizing real-time room load heatmaps and clinical SLA breach matrices.", bullet_style))
    
    doc.build(story)
    print("ReportLab PDF generated successfully with Arial TTF:", pdf_file)

if __name__ == "__main__":
    generate_pdf_native()
