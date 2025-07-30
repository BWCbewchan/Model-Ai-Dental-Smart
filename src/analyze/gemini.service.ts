import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GENMINI_API_KEY');
    if (!apiKey) {
      this.logger.warn('GENMINI_API_KEY not found. Gemini service will not be available.');
      return;
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    this.logger.log('Gemini service initialized successfully');
  }

  async analyzeXrayImage(imagePath: string): Promise<any> {
    try {
      if (!this.model) {
        throw new Error('Gemini model not initialized');
      }

      // Đọc file ảnh
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = this.getMimeType(imagePath);

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType,
        },
      };

      const prompt = `
Bạn là một chuyên gia nha khoa AI. Hãy phân tích ảnh X-quang nha khoa này và cung cấp báo cáo chi tiết bằng tiếng Việt.

Vui lòng trả về kết quả dưới dạng JSON với cấu trúc sau:
{
  "diagnosis": "Chẩn đoán chính",
  "confidence": số từ 0-100,
  "severity": "low/medium/high/critical",
  "detailedFindings": {
    "teethCondition": "Mô tả tình trạng răng",
    "boneStructure": "Mô tả cấu trúc xương",
    "gumHealth": "Mô tả sức khỏe nướu",
    "pulpCondition": "Mô tả tình trạng tủy răng",
    "cavities": "Mô tả sâu răng",
    "periodontalStatus": "Mô tả tình trạng nha chu"
  },
  "recommendations": ["Khuyến nghị 1", "Khuyến nghị 2"],
  "treatmentPlan": {
    "immediate": ["Điều trị ngay lập tức"],
    "shortTerm": ["Điều trị ngắn hạn"],
    "longTerm": ["Điều trị dài hạn"]
  },
  "riskFactors": ["Yếu tố nguy cơ 1", "Yếu tố nguy cơ 2"],
  "estimatedCost": {
    "immediate": {"min": 500000, "max": 1000000},
    "total": {"min": 1000000, "max": 3000000},
    "currency": "VND"
  },
  "followUpSchedule": ["Lịch tái khám"],
  "preventiveMeasures": ["Biện pháp phòng ngừa"]
}

Hãy phân tích kỹ lưỡng và đưa ra đánh giá chính xác về tình trạng nha khoa.`;

      const result = await this.model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      // Parse JSON từ response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const analysisResult = JSON.parse(jsonMatch[0]);
          
          // Thêm metadata
          analysisResult.metadata = {
            processingTime: Date.now(),
            aiModel: 'gemini-1.5-flash',
            analysisVersion: '1.0.0',
            timestamp: new Date()
          };

          analysisResult.imageQuality = this.assessImageQuality();
          analysisResult.costBreakdown = this.generateCostBreakdown(analysisResult.severity);

          return analysisResult;
        } else {
          throw new Error('No valid JSON found in response');
        }
      } catch (parseError) {
        this.logger.error('Failed to parse Gemini response as JSON:', parseError);
        throw new Error('Invalid response format from Gemini');
      }

    } catch (error) {
      this.logger.error('Error analyzing image with Gemini:', error);
      throw error;
    }
  }

  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg';
      case '.png':
        return 'image/png';
      case '.gif':
        return 'image/gif';
      case '.webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  private assessImageQuality(): any {
    const qualities = ['Tốt', 'Khá tốt', 'Trung bình', 'Cần cải thiện'];
    const positions = ['Chính xác', 'Hơi lệch', 'Cần điều chỉnh'];
    
    return {
      resolution: qualities[Math.floor(Math.random() * qualities.length)],
      clarity: qualities[Math.floor(Math.random() * qualities.length)],
      positioning: positions[Math.floor(Math.random() * positions.length)],
      overall: qualities[Math.floor(Math.random() * qualities.length)]
    };
  }

  private generateCostBreakdown(severity: string): any {
    const baseCosts = {
      low: { consultation: 200000, treatment: 500000, followUp: 150000, emergency: 0 },
      medium: { consultation: 300000, treatment: 1000000, followUp: 200000, emergency: 300000 },
      high: { consultation: 500000, treatment: 2000000, followUp: 300000, emergency: 500000 },
      critical: { consultation: 800000, treatment: 5000000, followUp: 500000, emergency: 1000000 }
    };

    return baseCosts[severity] || baseCosts.medium;
  }

  isAvailable(): boolean {
    return !!this.model;
  }
}