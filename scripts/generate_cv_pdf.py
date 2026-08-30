import os
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def generate_pdf(output_path):
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )
    
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontName='Helvetica-Bold',
        fontSize=18,
        leading=22,
        textColor=colors.HexColor('#0F172A'),
        spaceAfter=4
    )
    
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0284C7'),
        spaceAfter=8
    )
    
    link_style = ParagraphStyle(
        'LinkStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#0369A1'),
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=15,
        textColor=colors.HexColor('#0F172A'),
        spaceBefore=12,
        spaceAfter=6
    )
    
    project_title = ParagraphStyle(
        'ProjectTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11,
        leading=14,
        textColor=colors.HexColor('#0F172A'),
    )
    
    role_style = ParagraphStyle(
        'RoleStyle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10,
        leading=13,
        textColor=colors.HexColor('#0284C7'),
        spaceAfter=4
    )
    
    tech_stack = ParagraphStyle(
        'TechStack',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#334155'),
        spaceAfter=6
    )
    
    bullet_style = ParagraphStyle(
        'BulletStyle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9.5,
        leading=13.5,
        textColor=colors.HexColor('#1E293B'),
        leftIndent=12,
        firstLineIndent=-12,
        spaceAfter=5
    )

    story = []
    
    # Title & Subtitle
    story.append(Paragraph("MEDFLOW — CV & PORTFOLIO SHOWCASE", title_style))
    story.append(Paragraph("Enterprise Hospital Queue Intelligence & Operational Analytics Platform", subtitle_style))
    
    # Links Table
    links_data = [[
        Paragraph('<a href="https://medflow-frontend-y3e6.onrender.com/login" color="#0284C7"><b>Live Frontend App</b></a>', link_style),
        Paragraph('<a href="https://medflow-analytics.streamlit.app" color="#047857"><b>Live BI Dashboard (Streamlit)</b></a>', link_style),
        Paragraph('<a href="https://github.com/kieuwangtruong/MedFlow" color="#0F172A"><b>GitHub Repository</b></a>', link_style),
    ]]
    link_table = Table(links_data, colWidths=[170, 190, 160])
    link_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#F1F5F9')),
        ('BOX', (0,0), (-1,-1), 1, colors.HexColor('#CBD5E1')),
        ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor('#E2E8F0')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(link_table)
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0284C7'), spaceBefore=4, spaceAfter=8))
    
    # SECTION 1: ENGLISH VERSION
    story.append(Paragraph("1. ENGLISH RESUME SECTION (ATS & US TECH COMPLIANT)", section_heading))
    story.append(Paragraph("<b>MEDFLOW – Hospital Queue Intelligence & Operational Analytics Platform</b>", project_title))
    story.append(Paragraph("Role: Data Analyst / Analytics Engineer &nbsp;|&nbsp; Oct 2025 – Present", role_style))
    story.append(Paragraph("<b>Tech Stack:</b> Python (Pandas, Plotly, SciPy, Streamlit), SQL (PostgreSQL/Neon), Star Schema (DAMA-DMBOK), Power BI (DAX), FastAPI, Node.js/Express, Docker.", tech_stack))
    
    story.append(Paragraph("&bull; <b>Enterprise Data Modeling:</b> Architected a 4-layer Medallion Data Platform and Star Schema (Fact/Dimension) compliant with DAMA-DMBOK, consolidating over 10,000+ patient journey records across 12 clinical specialties.", bullet_style))
    story.append(Paragraph("&bull; <b>DAX & Percentile Semantic Layer:</b> Built a library of <b>20+ advanced DAX measures</b> and statistical distribution models (P50, P80, P90 percentiles via <code>PERCENTILE.INC</code>), replacing skewed mean averages to accurately capture the true wait experience of 85%+ of patients.", bullet_style))
    story.append(Paragraph("&bull; <b>Real-time Executive Control Center:</b> Deployed a multi-page interactive Streamlit dashboard tracking the closed-loop 3-step patient journey (A &rarr; B &rarr; A': Initial Consult &rarr; Diagnostic Imaging &rarr; Return Review), intraday peak hour heatmaps, and priority-based SLA breach rates.", bullet_style))
    story.append(Paragraph("&bull; <b>AI What-If Simulation Sandbox:</b> Engineered a discrete-event simulation engine benchmarking 3 patient routing strategies (<i>Round-Robin</i>, <i>Shortest Queue First</i>, and <i>AI Dynamic Routing</i>), demonstrating an <b>18% reduction in median operational wait time</b> under resource failure and emergency surge constraints.", bullet_style))
    
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E2E8F0'), spaceBefore=6, spaceAfter=8))
    
    # SECTION 2: VIETNAMESE VERSION
    story.append(Paragraph("2. BẢN TIẾNG VIỆT (DÀNH CHO DOANH NGHIỆP TRONG NƯỚC / Y TẾ)", section_heading))
    story.append(Paragraph("<b>MEDFLOW – Nền Tảng Giám Sát Vận Hành Hàng Đợi & Phân Tích Dữ Liệu Y Tế</b>", project_title))
    story.append(Paragraph("Vai trò: Chuyên viên Phân tích Dữ liệu (Data Analyst / Analytics Engineer) &nbsp;|&nbsp; 10/2025 – Hiện tại", role_style))
    story.append(Paragraph("<b>Công nghệ:</b> Python (Pandas, Streamlit, Plotly, SciPy), SQL, PostgreSQL/Neon, Star Schema (DAMA-DMBOK), Power BI (DAX Measures), FastAPI, RESTful API.", tech_stack))
    
    story.append(Paragraph("&bull; <b>Thiết Kế Kiến Trúc Dữ Liệu Chuẩn:</b> Xây dựng mô hình Star Schema 4 tầng Medallion (Fact/Dimension) theo tiêu chuẩn DAMA-DMBOK, chuẩn hóa dữ liệu tiếp đón và điều phối của 12 chuyên khoa lâm sàng.", bullet_style))
    story.append(Paragraph("&bull; <b>Mô Hình Tính Toán Phân Vị Nâng Cao:</b> Xây dựng bộ thư viện <b>20+ DAX Measures</b> và thuật toán phân vị (P50, P80, P90), khắc phục hoàn toàn nhược điểm số trung bình (Mean), phản ánh chính xác 85% thời gian chờ thực tế của bệnh nhân.", bullet_style))
    story.append(Paragraph("&bull; <b>Trung Tâm Điều Hành Real-time (Executive Control Center):</b> Triển khai Dashboard Streamlit trực quan hóa luồng khám 3 bước khép kín (A &rarr; B &rarr; A': Khám ban đầu &rarr; Cận lâm sàng &rarr; Tái khám kết luận), Heatmap tải buồng khám và ma trận tuân thủ SLA y tế.", bullet_style))
    story.append(Paragraph("&bull; <b>Mô Phỏng San Tải AI (What-If Simulation Sandbox):</b> Lập trình công cụ mô phỏng ngẫu nhiên rời rạc (DES) so sánh 3 chiến lược điều phối hàng đợi (<i>Round-Robin, SQF, AI Dynamic Routing</i>), chứng minh khả năng <b>giảm 18% thời gian chờ</b> khi có ca cấp cứu hoặc sự cố thiết bị.", bullet_style))
    
    doc.build(story)
    print("PDF generated successfully at:", output_path)

if __name__ == "__main__":
    generate_pdf("CV_MEDFLOW_SHOWCASE.pdf")
